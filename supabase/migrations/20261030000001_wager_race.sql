-- =============================================================================
-- Verificación de cuentas de casino y Wager Race.
-- =============================================================================

create type public.verification_status as enum ('pending', 'approved', 'rejected');
create type public.wager_race_status as enum ('draft', 'published');

-- =============================================================================
-- Cuentas de casino verificadas
-- =============================================================================

create table public.casino_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  casino_id uuid not null references public.casinos (id) on delete cascade,
  account_id text not null check (account_id ~ '^[A-Za-z0-9._@-]{3,64}$'),
  screenshot_path text,
  status public.verification_status not null default 'pending',
  reject_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, casino_id)
);

-- Anti-multicuentas: una cuenta de casino no puede estar en dos usuarios (salvo rechazada).
create unique index casino_accounts_account_key
  on public.casino_accounts (casino_id, lower(account_id))
  where status <> 'rejected';

create index casino_accounts_pending_idx on public.casino_accounts (created_at) where status = 'pending';

create trigger casino_accounts_touch_updated_at
  before update on public.casino_accounts
  for each row execute function public.touch_updated_at();

-- Mismo criterio que maskAccountId() en src/lib/format.ts.
create function public.mask_account_id(p_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(trim(p_id)) <= 4 then '•••'
    when length(trim(p_id)) >= 10 then left(trim(p_id), 4) || '•••' || right(trim(p_id), 3)
    else left(trim(p_id), 2) || '•••' || right(trim(p_id), 2)
  end;
$$;

-- El viewer carga (o corrige) su cuenta de un casino. Vuelve a quedar pendiente.
create function public.submit_casino_account(p_casino uuid, p_account_id text, p_screenshot_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_account text := trim(coalesce(p_account_id, ''));
  v_existing public.casino_accounts%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  if not exists (select 1 from public.casinos c where c.id = p_casino and c.is_active) then
    raise exception 'invalid_casino' using errcode = '22023';
  end if;
  if v_account !~ '^[A-Za-z0-9._@-]{3,64}$' then
    raise exception 'invalid_account_id' using errcode = '22023';
  end if;
  -- La captura tiene que estar en la carpeta del propio usuario.
  if p_screenshot_path is null or split_part(p_screenshot_path, '/', 1) <> v_uid::text then
    raise exception 'invalid_screenshot' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('casino_account', 5, 600) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  select * into v_existing from public.casino_accounts a where a.user_id = v_uid and a.casino_id = p_casino for update;
  if v_existing.status = 'approved' then
    raise exception 'already_verified' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.casino_accounts a
     where a.casino_id = p_casino and lower(a.account_id) = lower(v_account)
       and a.user_id <> v_uid and a.status <> 'rejected'
  ) then
    raise exception 'account_taken' using errcode = '23505';
  end if;

  if v_existing.id is not null then
    update public.casino_accounts
       set account_id = v_account, screenshot_path = p_screenshot_path, status = 'pending',
           reject_reason = null, reviewed_by = null, reviewed_at = null
     where id = v_existing.id
    returning id into v_id;
  else
    insert into public.casino_accounts (user_id, casino_id, account_id, screenshot_path)
    values (v_uid, p_casino, v_account, p_screenshot_path)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function public.review_casino_account(p_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.casino_accounts
     set status = case when p_approve then 'approved'::public.verification_status else 'rejected' end,
         reject_reason = case when p_approve then null else nullif(left(trim(coalesce(p_reason, '')), 200), '') end,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
end;
$$;

-- =============================================================================
-- Wager Race
-- =============================================================================

create table public.wager_races (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 80),
  casino_id uuid not null references public.casinos (id) on delete restrict,
  currency public.currency_code not null default 'USD',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Premio por puesto: prizes[1] es el primero.
  prizes numeric(14, 2)[] not null default '{}' check (array_position(prizes, null) is null),
  rules_md text,
  status public.wager_race_status not null default 'draft',
  wager_updated_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (cardinality(prizes) <= 50)
);

create index wager_races_dates_idx on public.wager_races (ends_at desc) where status = 'published';

create trigger wager_races_touch_updated_at
  before update on public.wager_races
  for each row execute function public.touch_updated_at();

create table public.wager_entries (
  race_id uuid not null references public.wager_races (id) on delete cascade,
  account_id uuid not null references public.casino_accounts (id) on delete cascade,
  wager numeric(16, 2) not null check (wager >= 0),
  updated_at timestamptz not null default now(),
  primary key (race_id, account_id)
);

create index wager_entries_ranking_idx on public.wager_entries (race_id, wager desc);

create trigger wager_entries_touch_updated_at
  before update on public.wager_entries
  for each row execute function public.touch_updated_at();

-- Carga el wager desde el reporte del casino ([{account_id, wager}]). Solo cuentan
-- las cuentas aprobadas de ese casino. Reemplaza el valor anterior de cada cuenta.
create function public.import_wagers(p_race uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_casino uuid;
  v_matched integer;
  v_unmatched jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select r.casino_id into v_casino from public.wager_races r where r.id = p_race;
  if v_casino is null then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 20000 then
    raise exception 'invalid_rows' using errcode = '22023';
  end if;

  with input as (
    select distinct on (lower(trim(r ->> 'account_id')))
           trim(r ->> 'account_id') as account_id,
           (r ->> 'wager')::numeric as wager
      from jsonb_array_elements(p_rows) r
     where length(trim(coalesce(r ->> 'account_id', ''))) > 0
       and (r ->> 'wager') ~ '^[0-9]+(\.[0-9]+)?$'
  ),
  matched as (
    select a.id, round(i.wager, 2) as wager, i.account_id
      from input i
      join public.casino_accounts a
        on a.casino_id = v_casino and lower(a.account_id) = lower(i.account_id) and a.status = 'approved'
  ),
  upserted as (
    insert into public.wager_entries (race_id, account_id, wager)
    select p_race, m.id, m.wager from matched m
    on conflict (race_id, account_id) do update set wager = excluded.wager
    returning 1
  )
  select (select count(*) from upserted),
         coalesce((select jsonb_agg(i.account_id) from (
           select i.account_id from input i
            where not exists (select 1 from matched m where m.account_id = i.account_id)
            limit 100) i), '[]'::jsonb)
    into v_matched, v_unmatched;

  update public.wager_races set wager_updated_at = now() where id = p_race;
  return jsonb_build_object('matched', v_matched, 'unmatched', v_unmatched);
end;
$$;

-- Ranking público: sin IDs completos, solo el enmascarado.
create function public.wager_leaderboard(p_race uuid, p_limit integer default 100)
returns table (
  rank integer,
  user_id uuid,
  display_name text,
  avatar_url text,
  masked_account text,
  wager numeric,
  prize numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with race as (
    select r.* from public.wager_races r
     where r.id = p_race and (r.status = 'published' or public.is_admin())
  ),
  ranked as (
    select row_number() over (order by e.wager desc, e.updated_at, a.created_at)::integer as rank,
           p.id as user_id,
           coalesce(nullif(p.display_name, ''), p.twitch_login, 'Viewer') as display_name,
           p.avatar_url,
           public.mask_account_id(a.account_id) as masked_account,
           e.wager
      from race
      join public.wager_entries e on e.race_id = race.id
      join public.casino_accounts a on a.id = e.account_id and a.status = 'approved'
      join public.profiles p on p.id = a.user_id and p.banned_at is null
     where e.wager > 0
  )
  select r.rank, r.user_id, r.display_name, r.avatar_url, r.masked_account, r.wager,
         (select race.prizes[r.rank] from race)
    from ranked r
   order by r.rank
   limit least(greatest(p_limit, 1), 500);
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.casino_accounts enable row level security;
alter table public.wager_races enable row level security;
alter table public.wager_entries enable row level security;

create policy "casino_accounts_select_own_or_admin" on public.casino_accounts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "wager_races_select" on public.wager_races
  for select to anon, authenticated
  using (status = 'published' or public.is_admin());

create policy "wager_races_admin_write" on public.wager_races
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- El ranking público sale de wager_leaderboard(); la tabla la ve el admin.
create policy "wager_entries_admin" on public.wager_entries
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- Grants
-- =============================================================================
revoke all on public.casino_accounts from anon;
revoke insert, update, delete on public.casino_accounts from authenticated;
revoke all on public.wager_entries from anon;
revoke insert, update, delete on public.wager_races from anon;

revoke execute on function public.submit_casino_account(uuid, text, text) from public, anon;
revoke execute on function public.review_casino_account(uuid, boolean, text) from public, anon;
revoke execute on function public.import_wagers(uuid, jsonb) from public, anon;
grant execute on function public.submit_casino_account(uuid, text, text) to authenticated;
grant execute on function public.review_casino_account(uuid, boolean, text) to authenticated;
grant execute on function public.import_wagers(uuid, jsonb) to authenticated;
grant execute on function public.wager_leaderboard(uuid, integer) to anon, authenticated;
grant execute on function public.mask_account_id(text) to anon, authenticated;
