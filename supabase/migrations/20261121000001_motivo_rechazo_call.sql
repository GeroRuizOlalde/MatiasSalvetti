-- =============================================================================
-- Motivo al rechazar un call (hunt, Bonus Buy y battle):
-- - not_triggered: el bono no salió. El viewer ya no puede pedir otro (como antes).
-- - already_called: esa máquina ya la pidió otro. Puede pedir otra.
-- - unavailable: la máquina no está disponible en el casino. Puede pedir otra.
-- El viewer ve el motivo en la web y en la notificación.
-- =============================================================================

alter table public.hunt_calls
  add column reject_reason text check (reject_reason in ('not_triggered', 'already_called', 'unavailable'));
alter table public.buy_calls
  add column reject_reason text check (reject_reason in ('not_triggered', 'already_called', 'unavailable'));
alter table public.battle_calls
  add column reject_reason text check (reject_reason in ('not_triggered', 'already_called', 'unavailable'));

-- Los rechazados de antes eran «no salió».
update public.hunt_calls set reject_reason = 'not_triggered' where status = 'rejected';
update public.buy_calls set reject_reason = 'not_triggered' where status = 'rejected';
update public.battle_calls set reject_reason = 'not_triggered' where status = 'rejected';

-- Volver a pedir: solo si el rechazo no fue porque el bono no salió.
create or replace function public.calls_no_retry_after_reject()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'rejected' and new.status <> 'rejected' then
    if coalesce(old.reject_reason, 'not_triggered') = 'not_triggered' then
      raise exception 'call_rejected' using errcode = '22023';
    end if;
    -- La misma máquina que se rechazó no se vuelve a pedir.
    if lower(trim(new.slot_name)) = lower(trim(old.slot_name)) then
      raise exception 'call_same_slot' using errcode = '22023';
    end if;
    new.reject_reason := null;
  end if;
  return new;
end;
$$;

-- Texto del motivo para las notificaciones.
create function public.call_reject_text(p_reason text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_reason
    when 'already_called' then 'esa máquina ya la pidió otro viewer. Podés pedir otra.'
    when 'unavailable' then 'la máquina no está disponible. Podés pedir otra.'
    else 'el bono no salió.'
  end;
$$;

drop function public.reject_hunt_call(uuid);

create function public.reject_hunt_call(p_call uuid, p_reason text default 'not_triggered')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('not_triggered', 'already_called', 'unavailable') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  update public.hunt_calls
     set status = 'rejected', reject_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_call and status = 'pending';
  if not found then
    raise exception 'call_not_pending' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.reject_hunt_call(uuid, text) from public, anon;
grant execute on function public.reject_hunt_call(uuid, text) to authenticated;

drop function public.reject_buy_call(uuid);

create function public.reject_buy_call(p_call uuid, p_reason text default 'not_triggered')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('not_triggered', 'already_called', 'unavailable') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  update public.buy_calls
     set status = 'rejected', reject_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_call and status = 'pending';
  if not found then
    raise exception 'call_not_pending' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.reject_buy_call(uuid, text) from public, anon;
grant execute on function public.reject_buy_call(uuid, text) to authenticated;

drop function public.reject_battle_call(uuid);

create function public.reject_battle_call(p_call uuid, p_reason text default 'not_triggered')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('not_triggered', 'already_called', 'unavailable') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  update public.battle_calls
     set status = 'rejected', reject_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_call and status = 'pending';
  if not found then
    raise exception 'call_not_pending' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.reject_battle_call(uuid, text) from public, anon;
grant execute on function public.reject_battle_call(uuid, text) to authenticated;

-- Avisos de rechazo con el motivo.
create or replace function public.notify_hunt_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := (select h.title from public.hunts h where h.id = new.hunt_id);
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    perform public.notify('panel', null, 'call_new', 'Nuevo call',
      public.viewer_name(new.user_id) || ' pidió ' || new.slot_name || ' · ' || v_title,
      '/panel/hunts/' || new.hunt_id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.notify('user', new.user_id, 'call_accepted', 'Tu call fue aceptado',
      new.slot_name || ' entró a ' || v_title, '/bonus-hunt/' || new.hunt_id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'rejected' then
    perform public.notify('user', new.user_id, 'call_rejected', 'Tu call fue rechazado',
      new.slot_name || ' no entró a ' || v_title || ': ' || public.call_reject_text(new.reject_reason), '/bonus-hunt/' || new.hunt_id);
  end if;
  return null;
end;
$$;

create or replace function public.notify_buy_call()
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
      new.slot_name || ' no entró a ' || v_title || ': ' || public.call_reject_text(new.reject_reason), '/bonus-buys/' || new.session_id);
  end if;
  return null;
end;
$$;

create or replace function public.notify_battle_call()
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
      new.slot_name || ' no entró a ' || v_title || ': ' || public.call_reject_text(new.reject_reason), '/bonus-battle/' || new.battle_id);
  end if;
  return null;
end;
$$;
