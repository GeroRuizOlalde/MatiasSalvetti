-- =============================================================================
-- Bonus Buys (sesiones de compras con votaciones) y Bonus Battle (eliminación
-- directa entre slots, con "bancá a tu slot").
-- =============================================================================

create type public.buy_session_status as enum ('draft', 'live', 'finished');
create type public.battle_status as enum ('draft', 'open', 'live', 'finished');

-- =============================================================================
-- Bonus Buys
-- =============================================================================

create table public.buy_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 80),
  casino_id uuid references public.casinos (id) on delete set null,
  currency public.currency_code not null default 'ARS',
  status public.buy_session_status not null default 'draft',
  finished_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index buy_sessions_status_created_idx on public.buy_sessions (status, created_at desc);

create trigger buy_sessions_touch_updated_at
  before update on public.buy_sessions
  for each row execute function public.touch_updated_at();

-- Una compra: se paga `cost` por el bonus de un slot jugado a `bet`. Multi = payout / bet.
create table public.buys (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.buy_sessions (id) on delete cascade,
  position integer not null,
  slot_id uuid references public.slots (id) on delete set null,
  slot_name text not null check (length(trim(slot_name)) between 1 and 120),
  provider text,
  bet numeric(14, 2) not null check (bet > 0),
  cost numeric(14, 2) not null check (cost > 0),
  payout numeric(14, 2) check (payout >= 0),
  multi numeric(14, 2) generated always as (round(payout / bet, 2)) stored,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

create index buys_session_idx on public.buys (session_id, position);
create index buys_multi_idx on public.buys (multi desc) where multi is not null;

-- Votaciones: "¿qué compramos ahora?". Una abierta por sesión a la vez.
create table public.buy_polls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.buy_sessions (id) on delete cascade,
  is_open boolean not null default true,
  winner_option_id uuid,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index buy_polls_one_open_idx on public.buy_polls (session_id) where is_open;

create table public.buy_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.buy_polls (id) on delete cascade,
  position integer not null,
  slot_id uuid references public.slots (id) on delete set null,
  slot_name text not null check (length(trim(slot_name)) between 1 and 120),
  unique (poll_id, position)
);

alter table public.buy_polls
  add constraint buy_polls_winner_fkey foreign key (winner_option_id) references public.buy_poll_options (id) on delete set null;

create table public.buy_poll_votes (
  poll_id uuid not null references public.buy_polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  option_id uuid not null references public.buy_poll_options (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index buy_poll_votes_option_idx on public.buy_poll_votes (option_id);

create trigger buy_poll_votes_touch_updated_at
  before update on public.buy_poll_votes
  for each row execute function public.touch_updated_at();

-- Posición automática, fecha de apertura y bloqueo de sesiones terminadas.
create function public.buys_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_session uuid := case when tg_op = 'DELETE' then old.session_id else new.session_id end;
begin
  if exists (select 1 from public.buy_sessions s where s.id = v_session and s.status = 'finished') then
    raise exception 'session_finished' using errcode = '22023';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.session_id <> old.session_id then
    raise exception 'cannot_move_buy' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' and new.position is null then
    select coalesce(max(b.position), 0) + 1 into new.position from public.buys b where b.session_id = new.session_id;
  end if;
  if new.payout is null then
    new.opened_at := null;
  elsif tg_op = 'INSERT' or old.payout is null then
    new.opened_at := now();
  end if;
  return new;
end;
$$;

create trigger buys_before_write
  before insert or update or delete on public.buys
  for each row execute function public.buys_before_write();

-- Al terminar la sesión, la votación abierta se cierra sola.
create function public.buy_sessions_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'finished' then
    if tg_op = 'INSERT' or old.status <> 'finished' then
      new.finished_at := now();
      if tg_op = 'UPDATE' then
        -- La sesión ya se está actualizando: que el cierre no la vuelva a tocar.
        perform set_config('app.skip_session_touch', 'on', true);
        perform public.close_open_buy_poll(new.id);
        perform set_config('app.skip_session_touch', 'off', true);
      end if;
    end if;
  else
    new.finished_at := null;
  end if;
  return new;
end;
$$;

-- Cierra la votación abierta de una sesión y elige la opción más votada
-- (en empate, la que estaba primero en la lista). Uso interno.
create function public.close_open_buy_poll(p_session uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll uuid;
  v_winner uuid;
begin
  select p.id into v_poll from public.buy_polls p where p.session_id = p_session and p.is_open for update;
  if v_poll is null then
    return null;
  end if;
  select o.id into v_winner
    from public.buy_poll_options o
    left join public.buy_poll_votes v on v.option_id = o.id
   where o.poll_id = v_poll
   group by o.id, o.position
  having count(v.user_id) > 0
   order by count(v.user_id) desc, o.position
   limit 1;
  update public.buy_polls set is_open = false, closed_at = now(), winner_option_id = v_winner where id = v_poll;
  return v_poll;
end;
$$;

create trigger buy_sessions_before_write
  before insert or update on public.buy_sessions
  for each row execute function public.buy_sessions_before_write();

-- Cada cambio de compras o votaciones toca la sesión: la web escucha solo `buy_sessions` por Realtime.
create function public.buy_children_touch_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.skip_session_touch', true) is distinct from 'on' then
    update public.buy_sessions set updated_at = now()
     where id = case when tg_op = 'DELETE' then old.session_id else new.session_id end;
  end if;
  return null;
end;
$$;

create trigger buys_touch_session
  after insert or update or delete on public.buys
  for each row execute function public.buy_children_touch_session();

create trigger buy_polls_touch_session
  after insert or update or delete on public.buy_polls
  for each row execute function public.buy_children_touch_session();

-- -----------------------------------------------------------------------------
-- Funciones de votación
-- -----------------------------------------------------------------------------

-- Abre una votación con 2 a 8 slots ([{slot_id?, slot_name}]). Cierra la anterior si había.
create function public.open_buy_poll(p_session uuid, p_options jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll uuid;
  v_count integer;
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.buy_sessions s where s.id = p_session and s.status = 'live') then
    raise exception 'session_not_live' using errcode = '22023';
  end if;
  if jsonb_typeof(p_options) <> 'array' then
    raise exception 'invalid_options' using errcode = '22023';
  end if;
  select count(*) into v_count
    from jsonb_array_elements(p_options) o
   where length(trim(coalesce(o ->> 'slot_name', ''))) > 0;
  if v_count < 2 or v_count > 8 then
    raise exception 'invalid_options' using errcode = '22023';
  end if;

  perform public.close_open_buy_poll(p_session);

  insert into public.buy_polls (session_id) values (p_session) returning id into v_poll;
  insert into public.buy_poll_options (poll_id, position, slot_id, slot_name)
  select v_poll,
         row_number() over (order by o.ord),
         (select s.id from public.slots s where s.id::text = o.value ->> 'slot_id'),
         left(trim(o.value ->> 'slot_name'), 120)
    from jsonb_array_elements(p_options) with ordinality as o (value, ord)
   where length(trim(coalesce(o.value ->> 'slot_name', ''))) > 0;
  return v_poll;
end;
$$;

create function public.close_buy_poll(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if public.close_open_buy_poll(p_session) is null then
    raise exception 'no_open_poll' using errcode = '22023';
  end if;
end;
$$;

-- Vota (o cambia el voto) en la votación abierta.
create function public.cast_buy_vote(p_option uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_poll uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  select p.id into v_poll
    from public.buy_poll_options o
    join public.buy_polls p on p.id = o.poll_id and p.is_open
    join public.buy_sessions s on s.id = p.session_id and s.status = 'live'
   where o.id = p_option;
  if v_poll is null then
    raise exception 'poll_closed' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('buy_vote', 10, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  insert into public.buy_poll_votes (poll_id, user_id, option_id)
  values (v_poll, v_uid, p_option)
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id;
end;
$$;

-- Votos por opción de las votaciones de una sesión visible.
create function public.buy_poll_counts(p_session uuid)
returns table (option_id uuid, votes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, count(v.user_id)::integer
    from public.buy_polls p
    join public.buy_sessions s on s.id = p.session_id and (s.status <> 'draft' or public.is_mod())
    join public.buy_poll_options o on o.poll_id = p.id
    left join public.buy_poll_votes v on v.option_id = o.id
   where p.session_id = p_session
   group by o.id;
$$;

-- =============================================================================
-- Bonus Battle
-- =============================================================================

create table public.battles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 80),
  casino_id uuid references public.casinos (id) on delete set null,
  currency public.currency_code not null default 'ARS',
  status public.battle_status not null default 'draft',
  winner_entry_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index battles_status_created_idx on public.battles (status, created_at desc);

create trigger battles_touch_updated_at
  before update on public.battles
  for each row execute function public.touch_updated_at();

create table public.battle_entries (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles (id) on delete cascade,
  seed integer not null check (seed > 0),
  slot_id uuid references public.slots (id) on delete set null,
  slot_name text not null check (length(trim(slot_name)) between 1 and 120),
  provider text,
  created_at timestamptz not null default now()
);

create index battle_entries_battle_idx on public.battle_entries (battle_id, seed);

alter table public.battles
  add constraint battles_winner_fkey foreign key (winner_entry_id) references public.battle_entries (id) on delete set null;

-- Un cruce: cada lado compra su bonus a `bet_*` y gana el de mayor multi
-- (en empate, el de mayor pago; si siguen iguales, el de mejor seed).
create table public.battle_matches (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles (id) on delete cascade,
  round integer not null check (round > 0),
  slot integer not null check (slot >= 0),
  entry_a uuid references public.battle_entries (id) on delete cascade,
  entry_b uuid references public.battle_entries (id) on delete cascade,
  bet_a numeric(14, 2) check (bet_a > 0),
  payout_a numeric(14, 2) check (payout_a >= 0),
  bet_b numeric(14, 2) check (bet_b > 0),
  payout_b numeric(14, 2) check (payout_b >= 0),
  winner_entry_id uuid references public.battle_entries (id) on delete set null,
  decided_at timestamptz,
  unique (battle_id, round, slot)
);

create table public.battle_picks (
  battle_id uuid not null references public.battles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid not null references public.battle_entries (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);

create index battle_picks_entry_idx on public.battle_picks (entry_id);

create trigger battle_picks_touch_updated_at
  before update on public.battle_picks
  for each row execute function public.touch_updated_at();

-- Los slots solo se cambian antes de arrancar.
create function public.battle_entries_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_battle uuid := case when tg_op = 'DELETE' then old.battle_id else new.battle_id end;
begin
  if exists (select 1 from public.battles b where b.id = v_battle and b.status in ('live', 'finished')) then
    raise exception 'battle_started' using errcode = '22023';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.battle_id <> old.battle_id then
    raise exception 'cannot_move_entry' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' and new.seed is null then
    select coalesce(max(e.seed), 0) + 1 into new.seed from public.battle_entries e where e.battle_id = new.battle_id;
  end if;
  return new;
end;
$$;

create trigger battle_entries_before_write
  before insert or update or delete on public.battle_entries
  for each row execute function public.battle_entries_before_write();

-- Estados: los cambios a 'live' y 'finished' los hacen start_battle y los resultados.
create function public.battles_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'open') then
      raise exception 'invalid_status' using errcode = '22023';
    end if;
    new.winner_entry_id := null;
    new.started_at := null;
    new.finished_at := null;
    return new;
  end if;

  if new.status is distinct from old.status and current_setting('app.battle_internal', true) is distinct from 'on' then
    if new.status not in ('draft', 'open') or old.status not in ('draft', 'open') then
      raise exception 'invalid_status' using errcode = '22023';
    end if;
  end if;
  if current_setting('app.battle_internal', true) is distinct from 'on' then
    new.winner_entry_id := old.winner_entry_id;
    new.started_at := old.started_at;
    new.finished_at := old.finished_at;
  end if;
  return new;
end;
$$;

create trigger battles_before_write
  before insert or update on public.battles
  for each row execute function public.battles_before_write();

-- Ganador del cruce cuando los dos lados tienen apuesta y pago.
create function public.battle_matches_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_seed_a integer;
  v_seed_b integer;
  v_multi_a numeric;
  v_multi_b numeric;
begin
  if new.entry_a is null or new.entry_b is null
     or new.bet_a is null or new.payout_a is null or new.bet_b is null or new.payout_b is null then
    new.winner_entry_id := null;
    new.decided_at := null;
    return new;
  end if;

  select e.seed into v_seed_a from public.battle_entries e where e.id = new.entry_a;
  select e.seed into v_seed_b from public.battle_entries e where e.id = new.entry_b;
  v_multi_a := new.payout_a / new.bet_a;
  v_multi_b := new.payout_b / new.bet_b;

  new.winner_entry_id := case
    when v_multi_a > v_multi_b then new.entry_a
    when v_multi_b > v_multi_a then new.entry_b
    when new.payout_a > new.payout_b then new.entry_a
    when new.payout_b > new.payout_a then new.entry_b
    when v_seed_a <= v_seed_b then new.entry_a
    else new.entry_b
  end;
  if old.winner_entry_id is distinct from new.winner_entry_id or new.decided_at is null then
    new.decided_at := now();
  end if;
  return new;
end;
$$;

create trigger battle_matches_before_update
  before update on public.battle_matches
  for each row execute function public.battle_matches_before_update();

-- El ganador avanza al cruce siguiente; el de la final gana la battle.
create function public.battle_matches_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rounds integer;
  v_next public.battle_matches%rowtype;
begin
  perform set_config('app.battle_internal', 'on', true);

  if new.winner_entry_id is not distinct from old.winner_entry_id then
    update public.battles set updated_at = now() where id = new.battle_id;
    perform set_config('app.battle_internal', 'off', true);
    return null;
  end if;

  select max(m.round) into v_rounds from public.battle_matches m where m.battle_id = new.battle_id;

  if new.round = v_rounds then
    update public.battles
       set winner_entry_id = new.winner_entry_id,
           status = case when new.winner_entry_id is null then 'live'::public.battle_status else 'finished' end,
           finished_at = case when new.winner_entry_id is null then null else now() end
     where id = new.battle_id;
  else
    select * into v_next from public.battle_matches m
     where m.battle_id = new.battle_id and m.round = new.round + 1 and m.slot = new.slot / 2
       for update;
    if v_next.payout_a is not null or v_next.payout_b is not null then
      raise exception 'next_match_started' using errcode = '22023';
    end if;
    if new.slot % 2 = 0 then
      update public.battle_matches set entry_a = new.winner_entry_id where id = v_next.id;
    else
      update public.battle_matches set entry_b = new.winner_entry_id where id = v_next.id;
    end if;
    update public.battles set updated_at = now() where id = new.battle_id;
  end if;

  perform set_config('app.battle_internal', 'off', true);
  return null;
end;
$$;

create trigger battle_matches_after_update
  after update on public.battle_matches
  for each row execute function public.battle_matches_after_update();

-- Arranca la battle: cierra el "bancá a tu slot" y arma el cuadro (seed 1 vs 2, 3 vs 4, ...).
create function public.start_battle(p_battle uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entries uuid[];
  v_count integer;
  v_rounds integer;
  v_round integer;
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.battles b where b.id = p_battle and b.status in ('draft', 'open') for update) then
    raise exception 'battle_started' using errcode = '22023';
  end if;

  select array_agg(e.id order by e.seed, e.created_at) into v_entries
    from public.battle_entries e where e.battle_id = p_battle;
  v_count := coalesce(array_length(v_entries, 1), 0);
  if v_count not in (2, 4, 8, 16) then
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

-- Vuelve una battle a 'open' borrando el cuadro (para corregir slots). Los picks se mantienen.
create function public.reset_battle(p_battle uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.battle_matches where battle_id = p_battle;
  perform set_config('app.battle_internal', 'on', true);
  update public.battles
     set status = 'open', winner_entry_id = null, started_at = null, finished_at = null
   where id = p_battle;
  perform set_config('app.battle_internal', 'off', true);
end;
$$;

-- "Bancá a tu slot": un pick por viewer, editable mientras la battle no arrancó.
create function public.pick_battle_entry(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_battle uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  select e.battle_id into v_battle
    from public.battle_entries e
    join public.battles b on b.id = e.battle_id and b.status = 'open'
   where e.id = p_entry;
  if v_battle is null then
    raise exception 'picks_closed' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('battle_pick', 10, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  insert into public.battle_picks (battle_id, user_id, entry_id)
  values (v_battle, v_uid, p_entry)
  on conflict (battle_id, user_id) do update set entry_id = excluded.entry_id;
end;
$$;

create function public.battle_pick_counts(p_battle uuid)
returns table (entry_id uuid, picks integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, count(p.user_id)::integer
    from public.battle_entries e
    join public.battles b on b.id = e.battle_id and (b.status <> 'draft' or public.is_mod())
    left join public.battle_picks p on p.entry_id = e.id
   where e.battle_id = p_battle
   group by e.id;
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.buy_sessions enable row level security;
alter table public.buys enable row level security;
alter table public.buy_polls enable row level security;
alter table public.buy_poll_options enable row level security;
alter table public.buy_poll_votes enable row level security;
alter table public.battles enable row level security;
alter table public.battle_entries enable row level security;
alter table public.battle_matches enable row level security;
alter table public.battle_picks enable row level security;

-- Sesiones y battles: los borradores solo los ve el panel.
create policy "buy_sessions_select" on public.buy_sessions
  for select to anon, authenticated
  using (status <> 'draft' or public.is_mod());
create policy "buy_sessions_mod_insert" on public.buy_sessions
  for insert to authenticated with check (public.is_mod());
create policy "buy_sessions_mod_update" on public.buy_sessions
  for update to authenticated using (public.is_mod()) with check (public.is_mod());
create policy "buy_sessions_delete" on public.buy_sessions
  for delete to authenticated using (public.is_admin() or (public.is_mod() and status = 'draft'));

create policy "buys_select" on public.buys
  for select to anon, authenticated
  using (exists (select 1 from public.buy_sessions s where s.id = session_id));
create policy "buys_mod_write" on public.buys
  for all to authenticated using (public.is_mod()) with check (public.is_mod());

create policy "buy_polls_select" on public.buy_polls
  for select to anon, authenticated
  using (exists (select 1 from public.buy_sessions s where s.id = session_id));
create policy "buy_poll_options_select" on public.buy_poll_options
  for select to anon, authenticated
  using (exists (select 1 from public.buy_polls p where p.id = poll_id));
create policy "buy_poll_votes_select_own_or_panel" on public.buy_poll_votes
  for select to authenticated
  using (user_id = auth.uid() or public.is_mod());

create policy "battles_select" on public.battles
  for select to anon, authenticated
  using (status <> 'draft' or public.is_mod());
create policy "battles_mod_insert" on public.battles
  for insert to authenticated with check (public.is_mod());
create policy "battles_mod_update" on public.battles
  for update to authenticated using (public.is_mod()) with check (public.is_mod());
create policy "battles_delete" on public.battles
  for delete to authenticated using (public.is_admin() or (public.is_mod() and status = 'draft'));

create policy "battle_entries_select" on public.battle_entries
  for select to anon, authenticated
  using (exists (select 1 from public.battles b where b.id = battle_id));
create policy "battle_entries_mod_write" on public.battle_entries
  for all to authenticated using (public.is_mod()) with check (public.is_mod());

create policy "battle_matches_select" on public.battle_matches
  for select to anon, authenticated
  using (exists (select 1 from public.battles b where b.id = battle_id));
create policy "battle_matches_mod_update" on public.battle_matches
  for update to authenticated using (public.is_mod()) with check (public.is_mod());

-- Quién bancó a quién se ve cuando la battle termina.
create policy "battle_picks_select" on public.battle_picks
  for select to anon, authenticated
  using (
    user_id = auth.uid()
    or public.is_mod()
    or exists (select 1 from public.battles b where b.id = battle_id and b.status = 'finished')
  );

-- =============================================================================
-- Grants
-- =============================================================================
revoke insert, update, delete on public.buy_sessions, public.buys, public.battles, public.battle_entries from anon;
revoke insert, update, delete on public.buy_polls, public.buy_poll_options from anon, authenticated;
revoke all on public.buy_poll_votes from anon;
revoke insert, update, delete on public.buy_poll_votes from authenticated;
revoke insert, update, delete on public.battle_picks from anon, authenticated;
-- Los cruces los crea start_battle; el panel solo carga apuestas y pagos.
revoke insert, update, delete on public.battle_matches from anon, authenticated;
grant update (bet_a, payout_a, bet_b, payout_b) on public.battle_matches to authenticated;

revoke execute on function public.buys_before_write() from public, anon, authenticated;
revoke execute on function public.buy_sessions_before_write() from public, anon, authenticated;
revoke execute on function public.close_open_buy_poll(uuid) from public, anon, authenticated;
revoke execute on function public.buy_children_touch_session() from public, anon, authenticated;
revoke execute on function public.battle_entries_before_write() from public, anon, authenticated;
revoke execute on function public.battles_before_write() from public, anon, authenticated;
revoke execute on function public.battle_matches_before_update() from public, anon, authenticated;
revoke execute on function public.battle_matches_after_update() from public, anon, authenticated;

revoke execute on function public.open_buy_poll(uuid, jsonb) from public, anon;
revoke execute on function public.close_buy_poll(uuid) from public, anon;
revoke execute on function public.cast_buy_vote(uuid) from public, anon;
revoke execute on function public.start_battle(uuid) from public, anon;
revoke execute on function public.reset_battle(uuid) from public, anon;
revoke execute on function public.pick_battle_entry(uuid) from public, anon;
grant execute on function public.open_buy_poll(uuid, jsonb) to authenticated;
grant execute on function public.close_buy_poll(uuid) to authenticated;
grant execute on function public.cast_buy_vote(uuid) to authenticated;
grant execute on function public.start_battle(uuid) to authenticated;
grant execute on function public.reset_battle(uuid) to authenticated;
grant execute on function public.pick_battle_entry(uuid) to authenticated;
grant execute on function public.buy_poll_counts(uuid) to anon, authenticated;
grant execute on function public.battle_pick_counts(uuid) to anon, authenticated;

-- =============================================================================
-- Realtime: las páginas públicas escuchan la sesión o la battle.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.buy_sessions, public.battles;
  end if;
end;
$$;
