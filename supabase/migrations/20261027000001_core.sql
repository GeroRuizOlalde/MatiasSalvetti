-- =============================================================================
-- Núcleo: perfiles, roles, configuración y documentos legales.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

create type public.user_role as enum ('viewer', 'mod', 'admin');
create type public.currency_code as enum ('ARS', 'USD');
create type public.legal_kind as enum ('terms', 'privacy', 'responsible_gaming');

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'viewer',
  twitch_id text unique,
  twitch_login text,
  display_name text not null default '',
  avatar_url text,
  twitch_created_at timestamptz,
  adult_confirmed_at timestamptz,
  terms_version integer,
  terms_accepted_at timestamptz,
  banned_at timestamptz,
  ban_reason text,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  points integer not null default 0 check (points >= 0),
  tickets integer not null default 0 check (tickets >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_twitch_login_idx on public.profiles (lower(twitch_login));
create index profiles_role_idx on public.profiles (role) where role <> 'viewer';

comment on table public.profiles is
  'Un perfil por usuario de Auth. Las columnas sensibles (rol, baneo, saldos) solo cambian por funciones SECURITY DEFINER o service role.';

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Datos de Twitch tal como los guarda Supabase Auth en raw_user_meta_data.
create function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_twitch_id text := coalesce(meta ->> 'provider_id', meta ->> 'sub');
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
    insert into public.profiles (id, twitch_id, twitch_login, display_name, avatar_url)
    values (new.id, v_twitch_id, v_login, coalesce(v_display, ''), v_avatar);
  elsif new.raw_user_meta_data is distinct from old.raw_user_meta_data then
    update public.profiles
       set twitch_id = coalesce(v_twitch_id, twitch_id),
           twitch_login = coalesce(v_login, twitch_login),
           display_name = coalesce(v_display, display_name),
           avatar_url = coalesce(v_avatar, avatar_url)
     where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_profile_from_auth();

create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth();

-- -----------------------------------------------------------------------------
-- Helpers de rol (SECURITY DEFINER para no recursar en las policies de profiles)
-- -----------------------------------------------------------------------------
create function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.banned_at is null;
$$;

create function public.is_mod()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.auth_role() in ('mod', 'admin'), false);
$$;

create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.auth_role() = 'admin', false);
$$;

-- -----------------------------------------------------------------------------
-- site_settings
-- -----------------------------------------------------------------------------
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create trigger site_settings_touch_updated_at
  before update on public.site_settings
  for each row execute function public.touch_updated_at();

create function public.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.value #>> '{}')::integer from public.site_settings s where s.key = p_key), p_default);
$$;

-- -----------------------------------------------------------------------------
-- legal_documents
-- -----------------------------------------------------------------------------
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind public.legal_kind not null,
  version integer not null check (version > 0),
  title text not null,
  content_md text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  unique (kind, version)
);

create function public.current_legal_version(p_kind public.legal_kind)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select max(d.version) from public.legal_documents d
   where d.kind = p_kind and d.published_at is not null and d.published_at <= now();
$$;

-- -----------------------------------------------------------------------------
-- Participación
-- -----------------------------------------------------------------------------

-- ¿El usuario logueado puede participar (calls, GTB, votos, sorteos)?
create function public.can_participate()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.banned_at is null
       and p.adult_confirmed_at is not null
       and p.terms_version is not null
       and p.terms_version >= coalesce(public.current_legal_version('terms'), 0)
       and (
         public.setting_int('twitch_min_account_age_days', 0) = 0
         or (
           p.twitch_created_at is not null
           and p.twitch_created_at <= now() - make_interval(days => public.setting_int('twitch_min_account_age_days', 0))
         )
       )
      from public.profiles p
     where p.id = auth.uid()
  ), false);
$$;

create function public.accept_terms(p_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current integer := public.current_legal_version('terms');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_current is null or p_version <> v_current then
    raise exception 'terms_version_mismatch' using errcode = '22023';
  end if;

  update public.profiles
     set adult_confirmed_at = coalesce(adult_confirmed_at, now()),
         terms_version = p_version,
         terms_accepted_at = now()
   where id = auth.uid();
end;
$$;

-- -----------------------------------------------------------------------------
-- Administración de usuarios (solo admin)
-- -----------------------------------------------------------------------------
create function public.set_user_role(p_user uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_change_own_role' using errcode = '22023';
  end if;
  update public.profiles set role = p_role where id = p_user;
end;
$$;

create function public.set_user_ban(p_user uuid, p_banned boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_ban_self' using errcode = '22023';
  end if;
  update public.profiles
     set banned_at = case when p_banned then coalesce(banned_at, now()) else null end,
         ban_reason = case when p_banned then nullif(trim(p_reason), '') else null end
   where id = p_user;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vista pública de perfiles: solo lo que la web muestra de otros usuarios.
-- Corre con permisos del dueño (no security_invoker) a propósito.
-- -----------------------------------------------------------------------------
create view public.public_profiles as
  select p.id, p.twitch_login, p.display_name, p.avatar_url, p.level, p.xp
    from public.profiles p;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.legal_documents enable row level security;

-- profiles: cada uno ve su fila; el panel ve todas. Sin UPDATE/INSERT/DELETE
-- directos: todo pasa por triggers, funciones o service role.
create policy "profiles_select_own_or_panel" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_mod());

create policy "site_settings_select" on public.site_settings
  for select to anon, authenticated
  using (is_public or public.is_admin());

create policy "site_settings_admin_write" on public.site_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Los mods manejan el respaldo manual de "en vivo" y el próximo stream.
create policy "site_settings_mod_stream_update" on public.site_settings
  for update to authenticated
  using (public.is_mod() and key in ('stream_manual', 'next_stream'))
  with check (public.is_mod() and key in ('stream_manual', 'next_stream'));

create policy "legal_documents_select" on public.legal_documents
  for select to anon, authenticated
  using ((published_at is not null and published_at <= now()) or public.is_admin());

create policy "legal_documents_admin_write" on public.legal_documents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.public_profiles to anon, authenticated;

revoke execute on function public.sync_profile_from_auth() from public, anon, authenticated;
revoke execute on function public.accept_terms(integer) from public, anon;
revoke execute on function public.set_user_role(uuid, public.user_role) from public, anon;
revoke execute on function public.set_user_ban(uuid, boolean, text) from public, anon;
grant execute on function public.accept_terms(integer) to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.set_user_ban(uuid, boolean, text) to authenticated;
