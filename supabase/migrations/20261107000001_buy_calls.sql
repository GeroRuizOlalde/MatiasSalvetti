-- =============================================================================
-- Calls en Bonus Buys: igual que en los hunts, el viewer pide una máquina y el
-- streamer la compra. Reemplaza a las votaciones en la web (las tablas de
-- votaciones quedan, sin uso, para no perder el historial).
-- - Una máquina por sesión, el call no se cambia; si se rechaza, puede pedir otro.
-- - Si la compra de un call paga más de 110x, se recomienda tipeo.
-- =============================================================================

alter table public.buy_sessions add column calls_open boolean not null default true;
alter table public.buys add column called_by uuid references public.profiles (id) on delete set null;

create table public.buy_calls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.buy_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot_id uuid references public.slots (id) on delete set null,
  slot_name text not null check (length(trim(slot_name)) between 1 and 120),
  status public.call_status not null default 'pending',
  buy_id uuid references public.buys (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index buy_calls_pending_idx on public.buy_calls (session_id, created_at) where status = 'pending';

create trigger buy_calls_touch_updated_at
  before update on public.buy_calls
  for each row execute function public.touch_updated_at();

alter table public.buy_calls enable row level security;

create policy "buy_calls_select_own_or_panel" on public.buy_calls
  for select using (user_id = auth.uid() or public.is_mod());

revoke all on public.buy_calls from anon;
revoke insert, update, delete on public.buy_calls from authenticated;

-- -----------------------------------------------------------------------------
-- Viewers
-- -----------------------------------------------------------------------------
create function public.submit_buy_call(p_session uuid, p_slot uuid default null, p_slot_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := left(trim(coalesce(p_slot_name, '')), 120);
  v_slot uuid := null;
  v_existing public.buy_calls%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.buy_sessions s where s.id = p_session and s.calls_open and s.status = 'live'
  ) then
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

  perform pg_advisory_xact_lock(hashtext('buy_call:' || p_session::text));

  select * into v_existing from public.buy_calls c where c.session_id = p_session and c.user_id = v_uid for update;
  if v_existing.status = 'accepted' then
    raise exception 'call_already_accepted' using errcode = '22023';
  end if;
  if v_existing.status = 'pending' then
    raise exception 'call_already_sent' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.buy_calls c
     where c.session_id = p_session
       and c.status in ('pending', 'accepted')
       and ((v_slot is not null and c.slot_id = v_slot) or lower(trim(c.slot_name)) = lower(v_name))
  ) or exists (
    select 1 from public.buys b
     where b.session_id = p_session
       and ((v_slot is not null and b.slot_id = v_slot) or lower(trim(b.slot_name)) = lower(v_name))
  ) then
    raise exception 'slot_taken' using errcode = '22023';
  end if;

  if not public.hit_rate_limit('buy_call', 6, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  if v_existing.id is not null then
    update public.buy_calls
       set slot_id = v_slot, slot_name = v_name, status = 'pending', reviewed_by = null, reviewed_at = null,
           created_at = now()
     where id = v_existing.id
    returning id into v_id;
  else
    insert into public.buy_calls (session_id, user_id, slot_id, slot_name)
    values (p_session, v_uid, v_slot, v_name)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Máquinas que ya no se pueden pedir en una sesión (sin decir quién las pidió).
create function public.buy_taken_slots(p_session uuid)
returns table (slot_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (lower(trim(x.slot_name))) x.slot_name
    from (
      select c.slot_name from public.buy_calls c
       where c.session_id = p_session and c.status in ('pending', 'accepted')
      union all
      select b.slot_name from public.buys b where b.session_id = p_session
    ) x
   where exists (select 1 from public.buy_sessions s where s.id = p_session and s.status <> 'draft')
   order by lower(trim(x.slot_name)), x.slot_name;
$$;

-- -----------------------------------------------------------------------------
-- Panel
-- -----------------------------------------------------------------------------
create function public.accept_buy_call(p_call uuid, p_bet numeric, p_cost numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_call public.buy_calls%rowtype;
  v_buy uuid;
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_bet is null or p_bet <= 0 or p_cost is null or p_cost <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select * into v_call from public.buy_calls c where c.id = p_call for update;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if v_call.status <> 'pending' then
    raise exception 'call_not_pending' using errcode = '22023';
  end if;

  insert into public.buys (session_id, slot_id, slot_name, provider, bet, cost, called_by)
  values (
    v_call.session_id,
    v_call.slot_id,
    v_call.slot_name,
    (select s.provider from public.slots s where s.id = v_call.slot_id),
    round(p_bet, 2),
    round(p_cost, 2),
    v_call.user_id
  )
  returning id into v_buy;

  update public.buy_calls
     set status = 'accepted', buy_id = v_buy, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_call;
  return v_buy;
end;
$$;

create function public.reject_buy_call(p_call uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.buy_calls
     set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_call and status = 'pending';
  if not found then
    raise exception 'call_not_pending' using errcode = '22023';
  end if;
end;
$$;

-- Borrar una compra que vino de un call libera al viewer (como en los hunts).
create function public.buys_free_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.buy_calls c where c.buy_id = old.id;
  return old;
end;
$$;

create trigger buys_free_call
  before delete on public.buys
  for each row execute function public.buys_free_call();

-- -----------------------------------------------------------------------------
-- Tipeos también para compras: una fila es de un bono de hunt o de una compra.
-- -----------------------------------------------------------------------------
alter table public.tipeos
  alter column bonus_id drop not null,
  alter column hunt_id drop not null,
  add column buy_id uuid unique references public.buys (id) on delete cascade,
  add column session_id uuid references public.buy_sessions (id) on delete cascade,
  add constraint tipeos_one_source check (num_nonnulls(bonus_id, buy_id) = 1);

create index tipeos_session_idx on public.tipeos (session_id);

create function public.decide_buy_tipeo(p_buy uuid, p_give boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buy public.buys%rowtype;
  v_id uuid;
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_buy from public.buys b where b.id = p_buy for update;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if v_buy.called_by is null then
    raise exception 'bonus_not_called' using errcode = '22023';
  end if;
  if v_buy.multi is null or v_buy.multi <= public.tipeo_min_multi() then
    raise exception 'not_tipeo' using errcode = '22023';
  end if;

  insert into public.tipeos (buy_id, session_id, user_id, slot_name, bet, payout, multi, status, decided_by)
  values (
    v_buy.id, v_buy.session_id, v_buy.called_by, v_buy.slot_name, v_buy.bet, v_buy.payout, v_buy.multi,
    case when p_give then 'given' else 'dismissed' end::public.tipeo_status, auth.uid()
  )
  on conflict (buy_id) do update
    set status = excluded.status,
        decided_by = excluded.decided_by,
        bet = excluded.bet,
        payout = excluded.payout,
        multi = excluded.multi,
        created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Notificaciones
-- -----------------------------------------------------------------------------
create function public.notify_buy_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := (select s.title from public.buy_sessions s where s.id = new.session_id);
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    perform public.notify('panel', null, 'buy_call_new', 'Nuevo call en Buys',
      public.viewer_name(new.user_id) || ' pidió ' || new.slot_name || ' · ' || v_title,
      '/panel/buys/' || new.session_id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.notify('user', new.user_id, 'call_accepted', 'Tu call fue aceptado',
      new.slot_name || ' entró a ' || v_title, '/bonus-buys/' || new.session_id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'rejected' then
    perform public.notify('user', new.user_id, 'call_rejected', 'Tu call fue rechazado',
      new.slot_name || ' no entró a ' || v_title || '. Podés pedir otro.', '/bonus-buys/' || new.session_id);
  end if;
  return null;
end;
$$;

create trigger buy_calls_notify
  after insert or update of status on public.buy_calls
  for each row execute function public.notify_buy_call();

create function public.notify_buy_tipeo_hit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.called_by is not null
     and new.multi > public.tipeo_min_multi()
     and (tg_op = 'INSERT' or old.multi is null or old.multi <= public.tipeo_min_multi()) then
    perform public.notify('panel', null, 'tipeo_hit', 'Posible tipeo',
      public.viewer_name(new.called_by) || ' · ' || new.slot_name || ' pagó ' || public.format_multi(new.multi),
      '/panel/buys/' || new.session_id);
  end if;
  return null;
end;
$$;

create trigger buys_notify_tipeo
  after insert or update of payout, bet on public.buys
  for each row execute function public.notify_buy_tipeo_hit();

-- El tipeo dado ahora puede venir de un hunt o de buys.
create or replace function public.notify_tipeo_given()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'given' and new.user_id is not null and (tg_op = 'INSERT' or old.status <> 'given') then
    perform public.notify('user', new.user_id, 'tipeo_given', '¡Te dieron tipeo!',
      new.slot_name || ' pagó ' || public.format_multi(new.multi),
      case when new.hunt_id is not null then '/bonus-hunt/' || new.hunt_id else '/bonus-buys/' || new.session_id end);
  end if;
  return null;
end;
$$;

-- El call aceptado en buys suma lo mismo que en un hunt (premio «Call aceptado»).
create function public.reward_buy_call()
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

create trigger buy_calls_reward
  after update of status on public.buy_calls
  for each row execute function public.reward_buy_call();

revoke execute on function public.reward_buy_call() from public, anon, authenticated;
revoke execute on function public.submit_buy_call(uuid, uuid, text) from public, anon;
revoke execute on function public.accept_buy_call(uuid, numeric, numeric) from public, anon;
revoke execute on function public.reject_buy_call(uuid) from public, anon;
revoke execute on function public.decide_buy_tipeo(uuid, boolean) from public, anon;
revoke execute on function public.buy_taken_slots(uuid) from public;
revoke execute on function public.buys_free_call() from public, anon, authenticated;
revoke execute on function public.notify_buy_call() from public, anon, authenticated;
revoke execute on function public.notify_buy_tipeo_hit() from public, anon, authenticated;
grant execute on function public.submit_buy_call(uuid, uuid, text) to authenticated;
grant execute on function public.accept_buy_call(uuid, numeric, numeric) to authenticated;
grant execute on function public.reject_buy_call(uuid) to authenticated;
grant execute on function public.decide_buy_tipeo(uuid, boolean) to authenticated;
grant execute on function public.buy_taken_slots(uuid) to anon, authenticated;
