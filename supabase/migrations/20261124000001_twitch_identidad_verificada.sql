-- =============================================================================
-- Arreglos de la etapa 2 (Twitch).
--
-- 1. El ID de Twitch del perfil sale de auth.identities, que solo escribe Supabase
--    Auth al entrar con Twitch. Antes salía de raw_user_meta_data, que el propio
--    usuario puede editar (updateUser): podía ponerse el ID de otro y cobrar sus
--    follows, subs y bits.
-- 2. Chat: dos primeros mensajes simultáneos podían pasar el tope por minuto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ID de Twitch verificado
-- -----------------------------------------------------------------------------

-- La metadata sigue actualizando nombre y avatar, pero ya no toca el ID de Twitch.
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_login text := lower(coalesce(meta ->> 'name', meta ->> 'user_name', meta ->> 'preferred_username', meta ->> 'full_name'));
  v_display text := coalesce(
    meta -> 'custom_claims' ->> 'display_name',
    meta ->> 'nickname',
    meta ->> 'slug',
    meta ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1)
  );
  v_avatar text := coalesce(meta ->> 'avatar_url', meta ->> 'picture');
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id, twitch_login, display_name, avatar_url)
    values (new.id, v_login, coalesce(v_display, ''), v_avatar);
  elsif new.raw_user_meta_data is distinct from old.raw_user_meta_data then
    update public.profiles
       set twitch_login = coalesce(v_login, twitch_login),
           display_name = coalesce(v_display, display_name),
           avatar_url = coalesce(v_avatar, avatar_url)
     where id = new.id;
  end if;
  return new;
end;
$$;

-- El ID lo pone la identidad de Twitch que crea Supabase Auth al entrar.
create function public.sync_twitch_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider <> 'twitch' or new.provider_id is null then
    return new;
  end if;
  -- Si otra cuenta tenía ese ID (no debería pasar), lo suelta: es de esta identidad.
  update public.profiles set twitch_id = null where twitch_id = new.provider_id and id <> new.user_id;
  update public.profiles set twitch_id = new.provider_id
   where id = new.user_id and twitch_id is distinct from new.provider_id;
  return new;
end;
$$;

create trigger on_auth_identity_twitch
  after insert or update of provider_id on auth.identities
  for each row execute function public.sync_twitch_identity();

revoke execute on function public.sync_twitch_identity() from public, anon, authenticated;

-- Perfiles existentes: se corrige el ID con el de la identidad verificada.
-- Los que no coinciden se sueltan primero, por el índice único.
update public.profiles p
   set twitch_id = null
 where p.twitch_id is not null
   and not exists (
     select 1 from auth.identities i
      where i.user_id = p.id and i.provider = 'twitch' and i.provider_id = p.twitch_id
   );

update public.profiles p
   set twitch_id = i.provider_id
  from auth.identities i
 where i.user_id = p.id and i.provider = 'twitch' and p.twitch_id is null;

-- -----------------------------------------------------------------------------
-- 2. Chat: la fila del viewer se crea y se bloquea antes de mirar el tope
-- -----------------------------------------------------------------------------
create or replace function public.twitch_chat_message(p_twitch_user text, p_text text, p_message_id text)
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

  -- Así dos mensajes que llegan juntos se ponen en fila, también el primero de todos.
  insert into public.twitch_chat_state (user_id, minute, counted)
  values (v_user, v_minute, 0)
  on conflict (user_id) do nothing;
  select * into v_state from public.twitch_chat_state s where s.user_id = v_user for update;

  if v_state.last_text = v_text then
    return false;
  end if;
  v_count := case when v_state.minute = v_minute then v_state.counted else 0 end;

  update public.twitch_chat_state
     set minute = v_minute, counted = least(v_count + 1, v_cap), last_text = v_text
   where user_id = v_user;

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

revoke execute on function public.twitch_chat_message(text, text, text) from public, anon, authenticated;
