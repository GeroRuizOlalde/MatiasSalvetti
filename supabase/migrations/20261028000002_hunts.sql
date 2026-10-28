-- =============================================================================
-- Bonus Hunt: hunts, bonos, calls de viewers y "adiviná el balance" (GTB).
-- =============================================================================

create type public.hunt_status as enum ('draft', 'collecting', 'opening', 'finished');
create type public.call_status as enum ('pending', 'accepted', 'rejected');

-- -----------------------------------------------------------------------------
-- hunts
-- -----------------------------------------------------------------------------
create table public.hunts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 80),
  casino_id uuid references public.casinos (id) on delete set null,
  currency public.currency_code not null default 'ARS',
  start_cost numeric(14, 2) not null check (start_cost >= 0),
  status public.hunt_status not null default 'draft',
  calls_open boolean not null default false,
  guesses_open boolean not null default false,
  final_balance numeric(14, 2),
  gtb_winner_id uuid references public.profiles (id) on delete set null,
  finished_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'finished' or (not calls_open and not guesses_open))
);

create index hunts_status_created_idx on public.hunts (status, created_at desc);

create trigger hunts_touch_updated_at
  before update on public.hunts
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- hunt_bonuses
-- -----------------------------------------------------------------------------
create table public.hunt_bonuses (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts (id) on delete cascade,
  position integer not null,
  slot_id uuid references public.slots (id) on delete set null,
  slot_name text not null check (length(trim(slot_name)) between 1 and 120),
  provider text,
  bet numeric(14, 2) not null check (bet > 0),
  payout numeric(14, 2) check (payout >= 0),
  multi numeric(14, 2) generated always as (round(payout / bet, 2)) stored,
  called_by uuid references public.profiles (id) on delete set null,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

create index hunt_bonuses_hunt_idx on public.hunt_bonuses (hunt_id, position);
create index hunt_bonuses_multi_idx on public.hunt_bonuses (multi desc) where multi is not null;

-- -----------------------------------------------------------------------------
-- hunt_calls: un viewer pide un slot. Uno por viewer y hunt.
-- -----------------------------------------------------------------------------
create table public.hunt_calls (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot_id uuid references public.slots (id) on delete set null,
  slot_name text not null check (length(trim(slot_name)) between 1 and 120),
  status public.call_status not null default 'pending',
  bonus_id uuid references public.hunt_bonuses (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hunt_id, user_id)
);

create index hunt_calls_pending_idx on public.hunt_calls (hunt_id, created_at) where status = 'pending';

create trigger hunt_calls_touch_updated_at
  before update on public.hunt_calls
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- hunt_guesses: "adiviná el balance". Uno por viewer y hunt, editable mientras esté abierto.
-- -----------------------------------------------------------------------------
create table public.hunt_guesses (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(14, 2) not null check (amount >= 0 and amount < 1000000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hunt_id, user_id)
);

create trigger hunt_guesses_touch_updated_at
  before update on public.hunt_guesses
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Triggers de bonos: posición automática, fecha de apertura y bloqueo de hunts cerrados.
-- -----------------------------------------------------------------------------
create function public.hunt_bonuses_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_hunt uuid := case when tg_op = 'DELETE' then old.hunt_id else new.hunt_id end;
begin
  if exists (select 1 from public.hunts h where h.id = v_hunt and h.status = 'finished') then
    raise exception 'hunt_finished' using errcode = '22023';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.hunt_id <> old.hunt_id then
    raise exception 'cannot_move_bonus' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' and new.position is null then
    select coalesce(max(b.position), 0) + 1 into new.position
      from public.hunt_bonuses b where b.hunt_id = new.hunt_id;
  end if;

  if new.payout is null then
    new.opened_at := null;
  elsif tg_op = 'INSERT' or old.payout is null then
    new.opened_at := now();
  end if;
  return new;
end;
$$;

create trigger hunt_bonuses_before_write
  before insert or update or delete on public.hunt_bonuses
  for each row execute function public.hunt_bonuses_before_write();

-- Cada cambio de bono toca el hunt: la web escucha solo `hunts` por Realtime
-- (los DELETE de Realtime no se pueden filtrar por hunt).
create function public.hunt_bonuses_touch_hunt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.hunts set updated_at = now()
   where id = case when tg_op = 'DELETE' then old.hunt_id else new.hunt_id end;
  return null;
end;
$$;

create trigger hunt_bonuses_touch_hunt
  after insert or update or delete on public.hunt_bonuses
  for each row execute function public.hunt_bonuses_touch_hunt();

-- -----------------------------------------------------------------------------
-- Cierre del hunt: al pasar a 'finished' se calcula el balance final y el
-- ganador del GTB (el más cercano; en empate, el que lo cargó primero; los
-- baneados no ganan). Si se reabre, se limpia todo para recalcular al cerrar.
-- -----------------------------------------------------------------------------
create function public.hunts_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_finished boolean := tg_op = 'UPDATE' and old.status = 'finished';
begin
  if new.status <> 'finished' then
    new.final_balance := null;
    new.gtb_winner_id := null;
    new.finished_at := null;
  elsif v_was_finished then
    -- Un hunt cerrado no cambia sus resultados a mano.
    new.final_balance := old.final_balance;
    new.gtb_winner_id := old.gtb_winner_id;
    new.finished_at := old.finished_at;
  else
    if not exists (select 1 from public.hunt_bonuses b where b.hunt_id = new.id) then
      raise exception 'hunt_without_bonuses' using errcode = '22023';
    end if;
    if exists (select 1 from public.hunt_bonuses b where b.hunt_id = new.id and b.payout is null) then
      raise exception 'bonuses_pending' using errcode = '22023';
    end if;

    new.calls_open := false;
    new.guesses_open := false;
    new.finished_at := now();
    select sum(b.payout) into new.final_balance from public.hunt_bonuses b where b.hunt_id = new.id;
    select g.user_id into new.gtb_winner_id
      from public.hunt_guesses g
      join public.profiles p on p.id = g.user_id and p.banned_at is null
     where g.hunt_id = new.id
     order by abs(g.amount - new.final_balance), g.updated_at, g.id
     limit 1;
  end if;
  return new;
end;
$$;

create trigger hunts_before_write
  before insert or update on public.hunts
  for each row execute function public.hunts_before_write();

-- -----------------------------------------------------------------------------
-- Funciones para viewers
-- -----------------------------------------------------------------------------

-- Pide (o cambia mientras esté pendiente) el slot del viewer para un hunt.
create function public.submit_hunt_call(p_hunt uuid, p_slot uuid default null, p_slot_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := left(trim(coalesce(p_slot_name, '')), 120);
  v_slot uuid := null;
  v_existing public.hunt_calls%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.hunts h where h.id = p_hunt and h.calls_open and h.status in ('collecting', 'opening')
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

  select * into v_existing from public.hunt_calls c where c.hunt_id = p_hunt and c.user_id = v_uid for update;
  if v_existing.status = 'accepted' then
    raise exception 'call_already_accepted' using errcode = '22023';
  end if;

  if not public.hit_rate_limit('hunt_call', 6, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  if v_existing.id is not null then
    update public.hunt_calls
       set slot_id = v_slot, slot_name = v_name, status = 'pending', reviewed_by = null, reviewed_at = null,
           created_at = case when v_existing.status = 'rejected' then now() else created_at end
     where id = v_existing.id
    returning id into v_id;
  else
    insert into public.hunt_calls (hunt_id, user_id, slot_id, slot_name)
    values (p_hunt, v_uid, v_slot, v_name)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Carga o cambia la apuesta del viewer en el GTB.
create function public.submit_hunt_guess(p_hunt uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 0 or p_amount >= 1000000000000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.hunts h where h.id = p_hunt and h.guesses_open and h.status <> 'finished'
  ) then
    raise exception 'guesses_closed' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('hunt_guess', 10, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  insert into public.hunt_guesses (hunt_id, user_id, amount)
  values (p_hunt, v_uid, round(p_amount, 2))
  on conflict (hunt_id, user_id) do update set amount = excluded.amount;
end;
$$;

-- Cantidad de apuestas de un hunt visible (los montos se ven recién al cerrar).
create function public.hunt_guess_count(p_hunt uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.hunt_guesses g
    join public.hunts h on h.id = g.hunt_id
   where g.hunt_id = p_hunt and (h.status <> 'draft' or public.is_mod());
$$;

-- -----------------------------------------------------------------------------
-- Funciones para el panel
-- -----------------------------------------------------------------------------

-- Acepta un call: lo convierte en un bono del hunt con la apuesta indicada.
create function public.accept_hunt_call(p_call uuid, p_bet numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_call public.hunt_calls%rowtype;
  v_bonus uuid;
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_bet is null or p_bet <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select * into v_call from public.hunt_calls c where c.id = p_call for update;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if v_call.status <> 'pending' then
    raise exception 'call_not_pending' using errcode = '22023';
  end if;

  insert into public.hunt_bonuses (hunt_id, slot_id, slot_name, provider, bet, called_by)
  values (
    v_call.hunt_id,
    v_call.slot_id,
    v_call.slot_name,
    (select s.provider from public.slots s where s.id = v_call.slot_id),
    round(p_bet, 2),
    v_call.user_id
  )
  returning id into v_bonus;

  update public.hunt_calls
     set status = 'accepted', bonus_id = v_bonus, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_call;
  return v_bonus;
end;
$$;

create function public.reject_hunt_call(p_call uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.hunt_calls
     set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_call and status = 'pending';
  if not found then
    raise exception 'call_not_pending' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.hunts enable row level security;
alter table public.hunt_bonuses enable row level security;
alter table public.hunt_calls enable row level security;
alter table public.hunt_guesses enable row level security;

create policy "hunts_select" on public.hunts
  for select to anon, authenticated
  using (status <> 'draft' or public.is_mod());

create policy "hunts_mod_insert" on public.hunts
  for insert to authenticated
  with check (public.is_mod());

create policy "hunts_mod_update" on public.hunts
  for update to authenticated
  using (public.is_mod())
  with check (public.is_mod());

-- Los mods borran borradores; el admin, cualquier hunt.
create policy "hunts_delete" on public.hunts
  for delete to authenticated
  using (public.is_admin() or (public.is_mod() and status = 'draft'));

-- La subconsulta a hunts ya pasa por su RLS (los borradores solo los ve el panel).
create policy "hunt_bonuses_select" on public.hunt_bonuses
  for select to anon, authenticated
  using (exists (select 1 from public.hunts h where h.id = hunt_id));

create policy "hunt_bonuses_mod_write" on public.hunt_bonuses
  for all to authenticated
  using (public.is_mod())
  with check (public.is_mod());

create policy "hunt_calls_select_own_or_panel" on public.hunt_calls
  for select to authenticated
  using (user_id = auth.uid() or public.is_mod());

-- Los montos del GTB se ven recién cuando el hunt cierra.
create policy "hunt_guesses_select" on public.hunt_guesses
  for select to anon, authenticated
  using (
    user_id = auth.uid()
    or public.is_mod()
    or exists (select 1 from public.hunts h where h.id = hunt_id and h.status = 'finished')
  );

-- -----------------------------------------------------------------------------
-- Grants: calls y guesses solo se escriben por las funciones de arriba.
-- -----------------------------------------------------------------------------
revoke all on public.hunt_calls from anon;
revoke insert, update, delete on public.hunt_calls from authenticated;
revoke insert, update, delete on public.hunt_guesses from anon, authenticated;
revoke insert, update, delete on public.hunts, public.hunt_bonuses from anon;

revoke execute on function public.hunt_bonuses_before_write() from public, anon, authenticated;
revoke execute on function public.hunts_before_write() from public, anon, authenticated;
revoke execute on function public.hunt_bonuses_touch_hunt() from public, anon, authenticated;
revoke execute on function public.submit_hunt_call(uuid, uuid, text) from public, anon;
revoke execute on function public.submit_hunt_guess(uuid, numeric) from public, anon;
revoke execute on function public.accept_hunt_call(uuid, numeric) from public, anon;
revoke execute on function public.reject_hunt_call(uuid) from public, anon;
grant execute on function public.submit_hunt_call(uuid, uuid, text) to authenticated;
grant execute on function public.submit_hunt_guess(uuid, numeric) to authenticated;
grant execute on function public.accept_hunt_call(uuid, numeric) to authenticated;
grant execute on function public.reject_hunt_call(uuid) to authenticated;
grant execute on function public.hunt_guess_count(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: la página pública se actualiza sola cuando cambia el hunt (o sus bonos).
-- (La publicación existe en Supabase; en los tests con PGlite no.)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.hunts;
  end if;
end;
$$;
