-- =============================================================================
-- Puntos, etapa 2: Twitch.
-- - Autorización del canal (tokens solo del lado servidor).
-- - Eventos de EventSub, sin duplicados, con su lógica de puntos.
-- - Streams y minutos vistos: puntos por ver.
-- Todo lo escribe el servidor con la secret key: el cliente no toca nada de esto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Autorización del canal. Sin políticas: ni los admins la leen desde el cliente.
-- -----------------------------------------------------------------------------
create table public.twitch_channel_auth (
  broadcaster_id text primary key,
  login text not null,
  access_token text not null,
  refresh_token text not null,
  scopes text[] not null default '{}',
  expires_at timestamptz not null,
  -- Twitch rechazó el refresh: hay que volver a conectar.
  needs_reconnect boolean not null default false,
  connected_by uuid references public.profiles (id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.twitch_channel_auth enable row level security;
revoke all on public.twitch_channel_auth from anon, authenticated;

-- Estado de cada suscripción de EventSub (lo ve el admin en el panel).
create table public.twitch_subscriptions (
  type text primary key,
  version text not null,
  twitch_id text,
  status text not null,
  updated_at timestamptz not null default now()
);

alter table public.twitch_subscriptions enable row level security;
create policy "twitch_subscriptions_admin_select" on public.twitch_subscriptions
  for select to authenticated using (public.is_admin());
revoke all on public.twitch_subscriptions from anon;
revoke insert, update, delete on public.twitch_subscriptions from authenticated;

-- -----------------------------------------------------------------------------
-- Eventos recibidos. `message_id` es el de Twitch: los reintentos se descartan.
-- -----------------------------------------------------------------------------
create table public.twitch_events (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  type text not null,
  twitch_user_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index twitch_events_user_idx on public.twitch_events (twitch_user_id, type);
create index twitch_events_recent_idx on public.twitch_events (created_at desc);

alter table public.twitch_events enable row level security;
create policy "twitch_events_admin_select" on public.twitch_events
  for select to authenticated using (public.is_admin());
revoke all on public.twitch_events from anon;
revoke insert, update, delete on public.twitch_events from authenticated;

-- -----------------------------------------------------------------------------
-- Streams y minutos vistos
-- -----------------------------------------------------------------------------
create table public.twitch_streams (
  id uuid primary key default gen_random_uuid(),
  twitch_stream_id text unique,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
);

-- Un solo stream abierto a la vez.
create unique index twitch_streams_open_idx on public.twitch_streams ((true)) where ended_at is null;

alter table public.twitch_streams enable row level security;
create policy "twitch_streams_select" on public.twitch_streams
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.twitch_streams from anon, authenticated;

create table public.watch_minutes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  stream_id uuid not null references public.twitch_streams (id) on delete cascade,
  minutes integer not null default 0 check (minutes >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, stream_id)
);

alter table public.watch_minutes enable row level security;
create policy "watch_minutes_select_own_or_admin" on public.watch_minutes
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.watch_minutes from anon;
revoke insert, update, delete on public.watch_minutes from authenticated;

-- Último mensaje contado de cada viewer: tope por minuto y repetidos.
create table public.twitch_chat_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  minute timestamptz not null,
  counted integer not null default 0,
  last_text text
);

alter table public.twitch_chat_state enable row level security;
revoke all on public.twitch_chat_state from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Acreditar por un ID de Twitch. Devuelve false si no está registrado, está
-- baneado o bloqueado, o si ese motivo ya se pagó. La XP sube igual que los puntos.
-- -----------------------------------------------------------------------------
create function public.twitch_award(p_twitch_user text, p_kind text, p_points integer, p_ref text, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if p_twitch_user is null or coalesce(p_points, 0) <= 0 then
    return false;
  end if;
  select p.id into v_user from public.profiles p where p.twitch_id = p_twitch_user and p.banned_at is null;
  if v_user is null then
    return false;
  end if;
  return public.apply_points(v_user, p_kind, null, p_points, p_points, p_note, p_ref);
end;
$$;

-- Marca el stream como abierto o cerrado. Lo usan los eventos y la tarea de 5 minutos.
create function public.twitch_set_stream(p_live boolean, p_stream_id text default null, p_started_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open public.twitch_streams%rowtype;
  v_id uuid;
begin
  -- Un evento y la tarea pueden llegar juntos.
  perform pg_advisory_xact_lock(hashtext('twitch_stream'));
  select * into v_open from public.twitch_streams s where s.ended_at is null;

  if not p_live then
    update public.twitch_streams set ended_at = now() where ended_at is null;
    return null;
  end if;
  if v_open.id is not null then
    -- Otro ID de stream: el anterior se cortó sin avisar.
    if p_stream_id is null or v_open.twitch_stream_id is null or v_open.twitch_stream_id = p_stream_id then
      if v_open.twitch_stream_id is null and p_stream_id is not null then
        update public.twitch_streams set twitch_stream_id = p_stream_id where id = v_open.id;
      end if;
      return v_open.id;
    end if;
    update public.twitch_streams set ended_at = now() where id = v_open.id;
  end if;

  insert into public.twitch_streams (twitch_stream_id, started_at)
  values (p_stream_id, least(coalesce(p_started_at, now()), now()))
  on conflict (twitch_stream_id) do update set ended_at = null
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Un mensaje del chat: tope por minuto y los repetidos seguidos no cuentan.
-- -----------------------------------------------------------------------------
create function public.twitch_chat_message(p_twitch_user text, p_text text, p_message_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_state public.twitch_chat_state%rowtype;
  v_minute timestamptz := date_trunc('minute', now());
  v_text text := left(lower(regexp_replace(trim(coalesce(p_text, '')), '\s+', ' ', 'g')), 300);
  v_cap integer := greatest(public.points_setting('chat_per_minute', 1), 1);
  v_count integer;
begin
  select p.id into v_user from public.profiles p where p.twitch_id = p_twitch_user and p.banned_at is null;
  if v_user is null or v_text = '' then
    return false;
  end if;

  select * into v_state from public.twitch_chat_state s where s.user_id = v_user for update;
  if v_state.last_text = v_text then
    return false;
  end if;
  v_count := case when v_state.minute = v_minute then v_state.counted else 0 end;

  insert into public.twitch_chat_state (user_id, minute, counted, last_text)
  values (v_user, v_minute, least(v_count + 1, v_cap), v_text)
  on conflict (user_id) do update
    set minute = excluded.minute, counted = excluded.counted, last_text = excluded.last_text;

  if v_count >= v_cap then
    return false;
  end if;
  return public.apply_points(
    v_user, 'twitch_chat', null,
    public.points_setting('chat_points', 2), public.points_setting('chat_points', 2),
    null, 'chat:' || p_message_id
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Premios de un evento ya guardado. También se usa para acreditar lo que pasó
-- antes de que la persona se registrara.
-- -----------------------------------------------------------------------------
create function public.twitch_apply_event(p_event public.twitch_events)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := p_event.payload;
  v_month text := to_char(p_event.created_at at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM');
  v_count integer;
begin
  if p_event.type = 'channel.follow' then
    -- Una sola vez por persona, aunque deje de seguir y vuelva.
    perform public.twitch_award(
      p_event.twitch_user_id, 'twitch_follow', public.points_setting('follow_points', 200), 'follow', 'Seguiste el canal'
    );
  elsif p_event.type in ('channel.subscribe', 'channel.subscription.message') then
    -- Las subs regaladas las cobra el que regala. Una sub por mes, llegue por el evento que llegue.
    if coalesce((v_payload ->> 'is_gift')::boolean, false) then
      return;
    end if;
    perform public.twitch_award(
      p_event.twitch_user_id, 'twitch_sub', public.points_setting('sub_points', 1500), 'sub:' || v_month,
      'Suscripción al canal'
    );
  elsif p_event.type = 'channel.subscription.gift' then
    v_count := least(greatest(coalesce((v_payload ->> 'total')::integer, 1), 1), 1000);
    perform public.twitch_award(
      p_event.twitch_user_id, 'twitch_gift_sub', public.points_setting('gift_sub_points', 1000) * v_count,
      'gift:' || p_event.message_id, v_count || case when v_count = 1 then ' sub regalada' else ' subs regaladas' end
    );
  elsif p_event.type = 'channel.cheer' then
    v_count := least(greatest(coalesce((v_payload ->> 'bits')::integer, 0), 0), 1000000);
    perform public.twitch_award(
      p_event.twitch_user_id, 'twitch_bits', public.points_setting('bit_points', 1) * v_count,
      'bits:' || p_event.message_id, v_count || ' bits'
    );
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Entrada de un evento de EventSub. Devuelve false si ya se había procesado.
-- -----------------------------------------------------------------------------
create function public.twitch_handle_event(p_message_id text, p_type text, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_event public.twitch_events%rowtype;
  v_user text;
begin
  if p_message_id is null or p_type is null then
    return false;
  end if;
  v_user := case p_type
    when 'channel.chat.message' then v_payload ->> 'chatter_user_id'
    when 'channel.raid' then v_payload ->> 'from_broadcaster_user_id'
    when 'stream.online' then null
    when 'stream.offline' then null
    else v_payload ->> 'user_id'
  end;
  -- Del chat se guarda solo lo necesario: son muchos mensajes.
  if p_type = 'channel.chat.message' then
    v_payload := jsonb_build_object(
      'message_id', v_payload ->> 'message_id',
      'text', left(coalesce(v_payload #>> '{message,text}', ''), 500)
    );
  end if;

  insert into public.twitch_events (message_id, type, twitch_user_id, payload)
  values (p_message_id, p_type, v_user, v_payload)
  on conflict (message_id) do nothing
  returning * into v_event;
  if v_event.id is null then
    return false;
  end if;

  if p_type = 'stream.online' then
    perform public.twitch_set_stream(true, v_payload ->> 'id', (v_payload ->> 'started_at')::timestamptz);
  elsif p_type = 'stream.offline' then
    perform public.twitch_set_stream(false);
  elsif p_type = 'channel.chat.message' then
    perform public.twitch_chat_message(
      v_user, v_payload ->> 'text', coalesce(v_payload ->> 'message_id', p_message_id)
    );
  else
    perform public.twitch_apply_event(v_event);
  end if;
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Puntos por ver: la tarea de 5 minutos pasa quiénes están en el chat.
-- Una acreditación por usuario por intervalo, y solo con el stream abierto.
-- -----------------------------------------------------------------------------
create function public.twitch_watch_tick(p_twitch_users text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stream uuid;
  v_interval integer := greatest(public.points_setting('watch_interval_minutes', 5), 1);
  v_points integer := public.points_setting('watch_points', 10);
  v_bucket text;
  v_user record;
  v_count integer := 0;
begin
  select s.id into v_stream from public.twitch_streams s where s.ended_at is null;
  if v_stream is null or p_twitch_users is null then
    return 0;
  end if;
  v_bucket := 'watch:' || v_stream || ':' || floor(extract(epoch from now()) / (v_interval * 60))::bigint;

  for v_user in
    select p.id from public.profiles p
     where p.twitch_id = any (p_twitch_users) and p.banned_at is null and p.points_blocked_at is null
  loop
    if public.apply_points(v_user.id, 'twitch_watch', null, v_points, v_points, null, v_bucket) then
      insert into public.watch_minutes (user_id, stream_id, minutes)
      values (v_user.id, v_stream, v_interval)
      on conflict (user_id, stream_id) do update
        set minutes = public.watch_minutes.minutes + excluded.minutes, updated_at = now();
      v_count := v_count + 1;
    end if;
  end loop;

  -- Los mensajes del chat solo sirven para no contar dos veces: se limpian solos.
  delete from public.twitch_events
   where type = 'channel.chat.message' and created_at < now() - interval '7 days';
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Alguien se registra en la web: se le acredita el follow y la sub que ya tenía.
-- -----------------------------------------------------------------------------
create function public.twitch_backfill_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.twitch_events%rowtype;
begin
  if new.twitch_id is null or (tg_op = 'UPDATE' and old.twitch_id is not distinct from new.twitch_id) then
    return null;
  end if;
  for v_event in
    select * from public.twitch_events e
     where e.twitch_user_id = new.twitch_id
       and e.type in ('channel.follow', 'channel.subscribe', 'channel.subscription.message')
     order by e.created_at
  loop
    perform public.twitch_apply_event(v_event);
  end loop;
  return null;
end;
$$;

create trigger profiles_twitch_backfill
  after insert or update of twitch_id on public.profiles
  for each row execute function public.twitch_backfill_profile();

-- -----------------------------------------------------------------------------
-- Grants: todo esto lo llama solo el servidor.
-- -----------------------------------------------------------------------------
revoke execute on function public.twitch_award(text, text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.twitch_set_stream(boolean, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.twitch_chat_message(text, text, text) from public, anon, authenticated;
revoke execute on function public.twitch_apply_event(public.twitch_events) from public, anon, authenticated;
revoke execute on function public.twitch_handle_event(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.twitch_watch_tick(text[]) from public, anon, authenticated;
revoke execute on function public.twitch_backfill_profile() from public, anon, authenticated;
grant execute on function public.twitch_set_stream(boolean, text, timestamptz) to service_role;
grant execute on function public.twitch_handle_event(text, text, jsonb) to service_role;
grant execute on function public.twitch_watch_tick(text[]) to service_role;
grant all on public.twitch_channel_auth, public.twitch_subscriptions, public.twitch_events,
  public.twitch_streams, public.watch_minutes to service_role;
