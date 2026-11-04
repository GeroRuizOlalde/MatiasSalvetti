-- =============================================================================
-- Borrar cuenta: fallaba si el viewer había participado en un hunt, una sesión de
-- buys o una battle ya cerrados. Al borrar el perfil, la base desvincula a la
-- persona (ej. «este bono lo pidió X» pasa a sin usuario), pero las protecciones
-- de las sesiones cerradas bloqueaban esa desvinculación y cancelaban todo.
-- Ahora, mientras se borra un perfil, esas protecciones dejan pasar los cambios.
-- =============================================================================

create function public.is_deleting_account()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('app.deleting_account', true), '') = 'on';
$$;

-- Se activa al empezar a borrar el perfil (borrado en cascada desde auth.users) y dura
-- solo esa transacción.
create function public.profiles_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.deleting_account', 'on', true);
  return old;
end;
$$;

create trigger profiles_before_delete
  before delete on public.profiles
  for each row execute function public.profiles_before_delete();

revoke execute on function public.profiles_before_delete() from public, anon, authenticated;

-- hunt_bonuses_before_write
create or replace function public.hunt_bonuses_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_hunt uuid := case when tg_op = 'DELETE' then old.hunt_id else new.hunt_id end;
begin
  -- Borrando una cuenta: solo se desvincula a la persona (ver arriba), sin otras reglas.
  if public.is_deleting_account() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
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

-- hunts_before_write
create or replace function public.hunts_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_finished boolean := tg_op = 'UPDATE' and old.status = 'finished';
begin
  -- Borrando una cuenta: solo se desvincula a la persona (ver arriba), sin otras reglas.
  if public.is_deleting_account() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
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
    select new.opening_balance + coalesce(sum(b.payout), 0) into new.final_balance
      from public.hunt_bonuses b where b.hunt_id = new.id;
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

-- buys_before_write
create or replace function public.buys_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_session uuid := case when tg_op = 'DELETE' then old.session_id else new.session_id end;
begin
  -- Borrando una cuenta: solo se desvincula a la persona (ver arriba), sin otras reglas.
  if public.is_deleting_account() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
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

-- battle_entries_before_write
create or replace function public.battle_entries_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_battle uuid := case when tg_op = 'DELETE' then old.battle_id else new.battle_id end;
begin
  -- Borrando una cuenta: solo se desvincula a la persona (ver arriba), sin otras reglas.
  if public.is_deleting_account() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
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

-- battles_before_write
create or replace function public.battles_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Borrando una cuenta: solo se desvincula a la persona (ver arriba), sin otras reglas.
  if public.is_deleting_account() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
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

-- battles_size_guard
create or replace function public.battles_size_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Borrando una cuenta: solo se desvincula a la persona (ver arriba), sin otras reglas.
  if public.is_deleting_account() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
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
