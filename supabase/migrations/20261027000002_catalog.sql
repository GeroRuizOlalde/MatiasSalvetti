-- =============================================================================
-- Catálogo: casinos y slots.
-- =============================================================================

create table public.casinos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  logo_path text,
  referral_url text not null check (referral_url ~ '^https://'),
  code text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger casinos_touch_updated_at
  before update on public.casinos
  for each row execute function public.touch_updated_at();

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  provider text,
  image_path text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index slots_name_provider_key
  on public.slots (lower(name), lower(coalesce(provider, '')));

create index slots_name_trgm_idx
  on public.slots using gin (lower(name) extensions.gin_trgm_ops);

create trigger slots_touch_updated_at
  before update on public.slots
  for each row execute function public.touch_updated_at();

-- Autocompletado: primero coincidencias por prefijo, después por similitud.
create function public.search_slots(p_query text, p_limit integer default 10)
returns setof public.slots
language sql
stable
set search_path = ''
as $$
  select s.*
    from public.slots s
   where s.is_active
     and (
       lower(s.name) like lower(trim(p_query)) || '%'
       or lower(s.name) operator(extensions.%) lower(trim(p_query))
       or lower(s.name) like '%' || lower(trim(p_query)) || '%'
     )
   order by (lower(s.name) like lower(trim(p_query)) || '%') desc,
            extensions.similarity(lower(s.name), lower(trim(p_query))) desc,
            s.name
   limit least(greatest(p_limit, 1), 25);
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.casinos enable row level security;
alter table public.slots enable row level security;

create policy "casinos_select" on public.casinos
  for select to anon, authenticated
  using (is_active or public.is_admin());

create policy "casinos_admin_write" on public.casinos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "slots_select" on public.slots
  for select to anon, authenticated
  using (is_active or public.is_mod());

-- Los mods crean slots al vuelo mientras cargan un hunt.
create policy "slots_mod_insert" on public.slots
  for insert to authenticated
  with check (public.is_mod());

create policy "slots_mod_update" on public.slots
  for update to authenticated
  using (public.is_mod())
  with check (public.is_mod());

create policy "slots_admin_delete" on public.slots
  for delete to authenticated
  using (public.is_admin());

grant execute on function public.search_slots(text, integer) to anon, authenticated;
