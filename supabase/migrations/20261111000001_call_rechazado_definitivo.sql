-- =============================================================================
-- Un call rechazado ya no se puede volver a pedir en ese hunt, Bonus Buy o battle
-- (el rechazo suele ser porque el bono no salió). Antes el viewer podía pedir otro.
-- Las funciones de submit actualizan la fila rechazada a «pending»: este trigger lo
-- impide y avisa con `call_rejected`. La máquina sí queda libre para otro viewer.
-- =============================================================================

create function public.calls_no_retry_after_reject()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'rejected' and new.status <> 'rejected' then
    raise exception 'call_rejected' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger hunt_calls_no_retry
  before update of status on public.hunt_calls
  for each row execute function public.calls_no_retry_after_reject();

create trigger buy_calls_no_retry
  before update of status on public.buy_calls
  for each row execute function public.calls_no_retry_after_reject();

create trigger battle_calls_no_retry
  before update of status on public.battle_calls
  for each row execute function public.calls_no_retry_after_reject();

revoke execute on function public.calls_no_retry_after_reject() from public, anon, authenticated;

-- Avisos de rechazo sin el «Podés pedir otro».
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
      new.slot_name || ' no entró a ' || v_title || '.', '/bonus-hunt/' || new.hunt_id);
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
      new.slot_name || ' no entró a ' || v_title || '.', '/bonus-buys/' || new.session_id);
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
      new.slot_name || ' no entró a ' || v_title || '.', '/bonus-battle/' || new.battle_id);
  end if;
  return null;
end;
$$;
