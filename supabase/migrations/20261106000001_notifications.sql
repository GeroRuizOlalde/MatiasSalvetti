-- =============================================================================
-- Notificaciones dentro de la web.
-- - audience 'user': le pasó algo a un viewer (su call, su tipeo, su premio...).
-- - audience 'all': algo que le interesa a todos (arrancó un hunt, un sorteo...).
-- - audience 'panel': trabajo para mods y admins (call nuevo, posible tipeo...).
-- Las crean triggers; nadie las escribe directo. «Leídas» = anteriores a la última
-- vez que el usuario abrió la campanita (una marca para la web y otra para el panel).
-- =============================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('user', 'all', 'panel')),
  user_id uuid references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now(),
  check ((audience = 'user') = (user_id is not null))
);

create index notifications_user_idx on public.notifications (user_id, created_at desc) where audience = 'user';
create index notifications_audience_idx on public.notifications (audience, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated using (
    (audience = 'user' and user_id = auth.uid())
    or audience = 'all'
    or (audience = 'panel' and public.is_mod())
  );

revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;

alter table public.profiles
  add column notifications_read_at timestamptz not null default now(),
  add column panel_notifications_read_at timestamptz not null default now();

-- Marca como leídas las de la web (p_panel = false) o las del panel (true).
create function public.mark_notifications_read(p_panel boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_panel then
    update public.profiles set panel_notifications_read_at = now() where id = auth.uid();
  else
    update public.profiles set notifications_read_at = now() where id = auth.uid();
  end if;
end;
$$;

revoke execute on function public.mark_notifications_read(boolean) from public, anon;
grant execute on function public.mark_notifications_read(boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create function public.notify(
  p_audience text, p_user uuid, p_kind text, p_title text, p_body text, p_link text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (audience, user_id, kind, title, body, link)
  values (p_audience, p_user, p_kind, p_title, p_body, p_link);
$$;

create function public.viewer_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(p.display_name, ''), p.twitch_login, 'Un viewer') from public.profiles p where p.id = p_user;
$$;

-- 1066.67 -> "1066,67x"
create function public.format_multi(p_multi numeric)
returns text
language sql
immutable
set search_path = ''
as $$ select replace(to_char(p_multi, 'FM9999999990.00'), '.', ',') || 'x' $$;

-- -----------------------------------------------------------------------------
-- Calls: el panel se entera del nuevo; el viewer, de la respuesta.
-- -----------------------------------------------------------------------------
create function public.notify_hunt_call()
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
      new.slot_name || ' no entró a ' || v_title || '. Podés pedir otro.', '/bonus-hunt/' || new.hunt_id);
  end if;
  return null;
end;
$$;

create trigger hunt_calls_notify
  after insert or update of status on public.hunt_calls
  for each row execute function public.notify_hunt_call();

-- -----------------------------------------------------------------------------
-- Bonos: posible tipeo cuando un bono de un call pasa los 110x.
-- -----------------------------------------------------------------------------
create function public.notify_tipeo_hit()
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
      '/panel/hunts/' || new.hunt_id);
  end if;
  return null;
end;
$$;

create trigger hunt_bonuses_notify_tipeo
  after insert or update of payout, bet on public.hunt_bonuses
  for each row execute function public.notify_tipeo_hit();

create function public.notify_tipeo_given()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'given' and new.user_id is not null and (tg_op = 'INSERT' or old.status <> 'given') then
    perform public.notify('user', new.user_id, 'tipeo_given', '¡Te dieron tipeo!',
      new.slot_name || ' pagó ' || public.format_multi(new.multi), '/bonus-hunt/' || new.hunt_id);
  end if;
  return null;
end;
$$;

create trigger tipeos_notify
  after insert or update of status on public.tipeos
  for each row execute function public.notify_tipeo_given();

-- -----------------------------------------------------------------------------
-- Arrancó algo: cuando sale de borrador.
-- -----------------------------------------------------------------------------
create function public.notify_started()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_draft boolean := tg_op = 'INSERT' or old.status::text = 'draft';
begin
  if new.status::text = 'draft' or not v_was_draft then
    return null;
  end if;
  if tg_table_name = 'hunts' then
    perform public.notify('all', null, 'hunt_started', 'Arrancó un Bonus Hunt', new.title || ' · pedí tu slot',
      '/bonus-hunt/' || new.id);
  elsif tg_table_name = 'buy_sessions' then
    perform public.notify('all', null, 'buys_started', 'Arrancaron los Bonus Buys', new.title,
      '/bonus-buys/' || new.id);
  elsif tg_table_name = 'battles' then
    perform public.notify('all', null, 'battle_started', 'Arrancó una Bonus Battle', new.title,
      '/bonus-battle/' || new.id);
  elsif tg_table_name = 'wager_races' then
    perform public.notify('all', null, 'race_started', 'Nueva Wager Race', new.title, '/wager-race/' || new.id);
  elsif tg_table_name = 'giveaways' then
    perform public.notify('all', null, 'giveaway_started', 'Nuevo sorteo', new.title, '/sorteos');
  end if;
  return null;
end;
$$;

create trigger hunts_notify_started after insert or update of status on public.hunts
  for each row execute function public.notify_started();
create trigger buy_sessions_notify_started after insert or update of status on public.buy_sessions
  for each row execute function public.notify_started();
create trigger battles_notify_started after insert or update of status on public.battles
  for each row execute function public.notify_started();
create trigger wager_races_notify_started after insert or update of status on public.wager_races
  for each row execute function public.notify_started();
create trigger giveaways_notify_started after insert or update of status on public.giveaways
  for each row execute function public.notify_started();

-- -----------------------------------------------------------------------------
-- Verificaciones de cuentas de casino.
-- -----------------------------------------------------------------------------
create function public.notify_casino_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_casino text := (select c.name from public.casinos c where c.id = new.casino_id);
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    perform public.notify('panel', null, 'verification_new', 'Verificación para revisar',
      public.viewer_name(new.user_id) || ' · ' || v_casino, '/panel/verificaciones');
  elsif tg_op = 'UPDATE' and old.status <> new.status and new.status = 'approved' then
    perform public.notify('user', new.user_id, 'verification_approved', 'Cuenta verificada',
      'Tu cuenta de ' || v_casino || ' ya está verificada.', '/perfil');
  elsif tg_op = 'UPDATE' and old.status <> new.status and new.status = 'rejected' then
    perform public.notify('user', new.user_id, 'verification_rejected', 'No pudimos verificar tu cuenta',
      coalesce('Motivo: ' || new.reject_reason, 'Revisá los datos de tu cuenta de ' || v_casino || '.'), '/perfil');
  end if;
  return null;
end;
$$;

create trigger casino_accounts_notify
  after insert or update of status on public.casino_accounts
  for each row execute function public.notify_casino_account();

-- -----------------------------------------------------------------------------
-- Sorteos ganados y canjes de la tienda.
-- -----------------------------------------------------------------------------
create function public.notify_giveaway_winner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_giveaway public.giveaways%rowtype;
begin
  select * into v_giveaway from public.giveaways g where g.id = new.giveaway_id;
  perform public.notify('user', new.user_id, 'giveaway_won', '¡Ganaste un sorteo!',
    v_giveaway.title || ' · ' || v_giveaway.prize, '/sorteos');
  return null;
end;
$$;

create trigger giveaway_winners_notify
  after insert on public.giveaway_winners
  for each row execute function public.notify_giveaway_winner();

create function public.notify_shop_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify('panel', null, 'order_new', 'Nuevo canje',
      public.viewer_name(new.user_id) || ' canjeó ' || new.item_title, '/panel/puntos');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'delivered' then
    perform public.notify('user', new.user_id, 'order_delivered', 'Tu canje fue entregado', new.item_title,
      '/cuartel');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'cancelled' then
    perform public.notify('user', new.user_id, 'order_cancelled', 'Tu canje fue cancelado',
      new.item_title || coalesce(' · ' || new.note, ''), '/cuartel');
  end if;
  return null;
end;
$$;

create trigger shop_orders_notify
  after insert or update of status on public.shop_orders
  for each row execute function public.notify_shop_order();

-- Funciones internas: solo las usan los triggers.
revoke execute on function public.notify(text, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.viewer_name(uuid) from public, anon, authenticated;
revoke execute on function public.notify_hunt_call() from public, anon, authenticated;
revoke execute on function public.notify_tipeo_hit() from public, anon, authenticated;
revoke execute on function public.notify_tipeo_given() from public, anon, authenticated;
revoke execute on function public.notify_started() from public, anon, authenticated;
revoke execute on function public.notify_casino_account() from public, anon, authenticated;
revoke execute on function public.notify_giveaway_winner() from public, anon, authenticated;
revoke execute on function public.notify_shop_order() from public, anon, authenticated;

-- En vivo: la campanita escucha los INSERT (Realtime respeta el RLS de arriba).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
