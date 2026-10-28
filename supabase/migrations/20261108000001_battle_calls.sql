-- =============================================================================
-- Calls en Bonus Battle: cada viewer callea su slot (como en hunts y buys); los
-- aceptados arman el cuadro y en cada cruce pasa el que pagó más (ya era así).
-- Reemplaza al «bancá a tu slot» (las tablas de picks quedan, sin uso).
-- - Una máquina por battle, el call no se cambia; si se rechaza, puede pedir otro.
-- - El streamer elige desde qué instancia arranca (`size`): final (2), semifinal (4),
--   cuartos (8), octavos (16), 16avos (32) o 32avos (64). Entran hasta `size` slots y
--   la battle arranca cuando están todos.
-- - Premios: «Call aceptado» al entrar y «Campeón» si tu slot gana la battle.
-- - Notificaciones: call nuevo para el panel; aceptado/rechazado, pasaste de ronda,
--   quedaste afuera y ganaste para el viewer.
-- =============================================================================

alter table public.battle_entries add column called_by uuid references public.profiles (id) on delete set null;

alter table public.battles
  add column size integer not null default 16 check (size in (2, 4, 8, 16, 32, 64));

-- El tamaño se elige antes de arrancar y no puede quedar por debajo de los slots cargados.
create function public.battles_size_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.size is distinct from old.size then
    if old.status in ('live', 'finished') then
      raise exception 'battle_started' using errcode = '22023';
    end if;
    if (select count(*) from public.battle_entries e where e.battle_id = new.id) > new.size then
      raise exception 'size_too_small' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger battles_size_guard
  before update of size on public.battles
  for each row execute function public.battles_size_guard();

-- No entran más slots que el tamaño del cuadro (ni por call ni cargados a mano).
create function public.battle_entries_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.battle_entries e where e.battle_id = new.battle_id)
     >= (select b.size from public.battles b where b.id = new.battle_id) then
    raise exception 'battle_full' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger battle_entries_cap
  before insert on public.battle_entries
  for each row execute function public.battle_entries_cap();

-- Arranca la battle con el cuadro completo para la instancia elegida (seed 1 vs 2, 3 vs 4, ...).
create or replace function public.start_battle(p_battle uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entries uuid[];
  v_count integer;
  v_size integer;
  v_rounds integer;
  v_round integer;
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select b.size into v_size from public.battles b where b.id = p_battle and b.status in ('draft', 'open') for update;
  if v_size is null then
    raise exception 'battle_started' using errcode = '22023';
  end if;

  select array_agg(e.id order by e.seed, e.created_at) into v_entries
    from public.battle_entries e where e.battle_id = p_battle;
  v_count := coalesce(array_length(v_entries, 1), 0);
  if v_count <> v_size then
    raise exception 'invalid_entry_count' using errcode = '22023';
  end if;
  v_rounds := round(log(2, v_count))::integer;

  insert into public.battle_matches (battle_id, round, slot, entry_a, entry_b)
  select p_battle, 1, i, v_entries[i * 2 + 1], v_entries[i * 2 + 2]
    from generate_series(0, v_count / 2 - 1) i;

  for v_round in 2..v_rounds loop
    insert into public.battle_matches (battle_id, round, slot)
    select p_battle, v_round, i from generate_series(0, (v_count / (2 ^ v_round)::integer) - 1) i;
  end loop;

  perform set_config('app.battle_internal', 'on', true);
  update public.battles set status = 'live', started_at = now() where id = p_battle;
  perform set_config('app.battle_internal', 'off', true);
end;
$$;

create table public.battle_calls (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot_id uuid references public.slots (id) on delete set null,
  slot_name text not null check (length(trim(slot_name)) between 1 and 120),
  status public.call_status not null default 'pending',
  entry_id uuid references public.battle_entries (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (battle_id, user_id)
);

create index battle_calls_pending_idx on public.battle_calls (battle_id, created_at) where status = 'pending';

create trigger battle_calls_touch_updated_at
  before update on public.battle_calls
  for each row execute function public.touch_updated_at();

alter table public.battle_calls enable row level security;

create policy "battle_calls_select_own_or_panel" on public.battle_calls
  for select using (user_id = auth.uid() or public.is_mod());

revoke all on public.battle_calls from anon;
revoke insert, update, delete on public.battle_calls from authenticated;

-- -----------------------------------------------------------------------------
-- Viewers
-- -----------------------------------------------------------------------------
create function public.submit_battle_call(p_battle uuid, p_slot uuid default null, p_slot_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := left(trim(coalesce(p_slot_name, '')), 120);
  v_slot uuid := null;
  v_existing public.battle_calls%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  if not exists (select 1 from public.battles b where b.id = p_battle and b.status = 'open') then
    raise exception 'calls_closed' using errcode = '22023';
  end if;

  if p_slot is not null then
    select s.id, s.name into v_slot, v_name from public.slots s where s.id = p_slot and s.is_active;
    if v_slot is null then
      raise exception 'invalid_slot' using errcode = '22023';
    end if;
  end if;
  if length(v_name) = 0 then
    raise exception 'invalid_slot' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('battle_call:' || p_battle::text));

  select * into v_existing from public.battle_calls c where c.battle_id = p_battle and c.user_id = v_uid for update;
  if v_existing.status = 'accepted' then
    raise exception 'call_already_accepted' using errcode = '22023';
  end if;
  if v_existing.status = 'pending' then
    raise exception 'call_already_sent' using errcode = '22023';
  end if;
  if (select count(*) from public.battle_entries e where e.battle_id = p_battle)
     >= (select b.size from public.battles b where b.id = p_battle) then
    raise exception 'battle_full' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.battle_calls c
     where c.battle_id = p_battle
       and c.status in ('pending', 'accepted')
       and ((v_slot is not null and c.slot_id = v_slot) or lower(trim(c.slot_name)) = lower(v_name))
  ) or exists (
    select 1 from public.battle_entries e
     where e.battle_id = p_battle
       and ((v_slot is not null and e.slot_id = v_slot) or lower(trim(e.slot_name)) = lower(v_name))
  ) then
    raise exception 'slot_taken' using errcode = '22023';
  end if;

  if not public.hit_rate_limit('battle_call', 6, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  if v_existing.id is not null then
    update public.battle_calls
       set slot_id = v_slot, slot_name = v_name, status = 'pending', reviewed_by = null, reviewed_at = null,
           created_at = now()
     where id = v_existing.id
    returning id into v_id;
  else
    insert into public.battle_calls (battle_id, user_id, slot_id, slot_name)
    values (p_battle, v_uid, v_slot, v_name)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Máquinas que ya no se pueden pedir en una battle (sin decir quién las pidió).
create function public.battle_taken_slots(p_battle uuid)
returns table (slot_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (lower(trim(x.slot_name))) x.slot_name
    from (
      select c.slot_name from public.battle_calls c
       where c.battle_id = p_battle and c.status in ('pending', 'accepted')
      union all
      select e.slot_name from public.battle_entries e where e.battle_id = p_battle
    ) x
   where exists (select 1 from public.battles b where b.id = p_battle and b.status <> 'draft')
   order by lower(trim(x.slot_name)), x.slot_name;
$$;

-- -----------------------------------------------------------------------------
-- Panel
-- -----------------------------------------------------------------------------
create function public.accept_battle_call(p_call uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_call public.battle_calls%rowtype;
  v_entry uuid;
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_call from public.battle_calls c where c.id = p_call for update;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if v_call.status <> 'pending' then
    raise exception 'call_not_pending' using errcode = '22023';
  end if;
  -- battle_entries_before_write rechaza si la battle ya arrancó y battle_entries_cap si está completa.
  insert into public.battle_entries (battle_id, slot_id, slot_name, provider, called_by)
  values (
    v_call.battle_id,
    v_call.slot_id,
    v_call.slot_name,
    (select s.provider from public.slots s where s.id = v_call.slot_id),
    v_call.user_id
  )
  returning id into v_entry;

  update public.battle_calls
     set status = 'accepted', entry_id = v_entry, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_call;
  return v_entry;
end;
$$;

create function public.reject_battle_call(p_call uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.battle_calls
     set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_call and status = 'pending';
  if not found then
    raise exception 'call_not_pending' using errcode = '22023';
  end if;
end;
$$;

-- Quitar un slot que vino de un call libera al viewer.
create function public.battle_entries_free_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.battle_calls c where c.entry_id = old.id;
  return old;
end;
$$;

create trigger battle_entries_free_call
  before delete on public.battle_entries
  for each row execute function public.battle_entries_free_call();

-- -----------------------------------------------------------------------------
-- Premios
-- -----------------------------------------------------------------------------
create function public.reward_battle_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.award_reward(new.user_id, 'hunt_call', new.id);
  end if;
  return null;
end;
$$;

create trigger battle_calls_reward
  after update of status on public.battle_calls
  for each row execute function public.reward_battle_call();

-- El campeón ahora es del viewer que calleó el slot ganador (los picks viejos siguen sumando).
create or replace function public.reward_battle_finished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pick record;
  v_caller uuid;
begin
  if new.status = 'finished' and old.status <> 'finished' then
    for v_pick in select p.user_id, p.entry_id from public.battle_picks p where p.battle_id = new.id loop
      perform public.award_reward(v_pick.user_id, 'battle_pick', new.id);
      if v_pick.entry_id = new.winner_entry_id then
        perform public.award_reward(v_pick.user_id, 'battle_champion', new.id);
      end if;
    end loop;
    select e.called_by into v_caller from public.battle_entries e where e.id = new.winner_entry_id;
    if v_caller is not null then
      perform public.award_reward(v_caller, 'battle_champion', new.id);
    end if;
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Notificaciones
-- -----------------------------------------------------------------------------
create function public.notify_battle_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := (select b.title from public.battles b where b.id = new.battle_id);
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    perform public.notify('panel', null, 'battle_call_new', 'Nuevo call en la Battle',
      public.viewer_name(new.user_id) || ' pidió ' || new.slot_name || ' · ' || v_title,
      '/panel/battles/' || new.battle_id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.notify('user', new.user_id, 'call_accepted', 'Tu call fue aceptado',
      new.slot_name || ' entró a ' || v_title, '/bonus-battle/' || new.battle_id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'rejected' then
    perform public.notify('user', new.user_id, 'call_rejected', 'Tu call fue rechazado',
      new.slot_name || ' no entró a ' || v_title || '. Podés pedir otro.', '/bonus-battle/' || new.battle_id);
  end if;
  return null;
end;
$$;

create trigger battle_calls_notify
  after insert or update of status on public.battle_calls
  for each row execute function public.notify_battle_call();

-- Cuando se decide un cruce: el que pasó y el que quedó afuera se enteran.
create function public.notify_battle_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_final boolean;
  v_loser uuid;
  v_winner public.battle_entries%rowtype;
  v_loser_entry public.battle_entries%rowtype;
  v_link text := '/bonus-battle/' || new.battle_id;
begin
  if new.winner_entry_id is null or old.winner_entry_id is not null then
    return null;
  end if;
  v_final := new.round = (select max(m.round) from public.battle_matches m where m.battle_id = new.battle_id);
  v_loser := case when new.winner_entry_id = new.entry_a then new.entry_b else new.entry_a end;
  select * into v_winner from public.battle_entries e where e.id = new.winner_entry_id;
  select * into v_loser_entry from public.battle_entries e where e.id = v_loser;

  if v_winner.called_by is not null then
    if v_final then
      perform public.notify('user', v_winner.called_by, 'battle_won', '¡Tu slot ganó la Bonus Battle!',
        v_winner.slot_name || ' es el campeón.', v_link);
    else
      perform public.notify('user', v_winner.called_by, 'battle_advanced', 'Tu slot pasó de ronda',
        v_winner.slot_name || ' le ganó a ' || coalesce(v_loser_entry.slot_name, 'su rival') || '.', v_link);
    end if;
  end if;
  if v_loser_entry.called_by is not null then
    perform public.notify('user', v_loser_entry.called_by, 'battle_out', 'Tu slot quedó afuera',
      v_loser_entry.slot_name || ' perdió contra ' || v_winner.slot_name || '.', v_link);
  end if;
  return null;
end;
$$;

-- Sin "of winner_entry_id": el ganador lo pone el trigger BEFORE, no el UPDATE.
create trigger battle_matches_notify
  after update on public.battle_matches
  for each row execute function public.notify_battle_match();

revoke execute on function public.submit_battle_call(uuid, uuid, text) from public, anon;
revoke execute on function public.accept_battle_call(uuid) from public, anon;
revoke execute on function public.reject_battle_call(uuid) from public, anon;
revoke execute on function public.battle_taken_slots(uuid) from public;
revoke execute on function public.battles_size_guard() from public, anon, authenticated;
revoke execute on function public.battle_entries_cap() from public, anon, authenticated;
revoke execute on function public.battle_entries_free_call() from public, anon, authenticated;
revoke execute on function public.reward_battle_call() from public, anon, authenticated;
revoke execute on function public.notify_battle_call() from public, anon, authenticated;
revoke execute on function public.notify_battle_match() from public, anon, authenticated;
grant execute on function public.submit_battle_call(uuid, uuid, text) to authenticated;
grant execute on function public.accept_battle_call(uuid) to authenticated;
grant execute on function public.reject_battle_call(uuid) to authenticated;
grant execute on function public.battle_taken_slots(uuid) to anon, authenticated;
