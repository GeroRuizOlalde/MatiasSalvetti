-- =============================================================================
-- Sorteos: gratis (una participación) o con tickets (cada ticket es una chance).
-- El sorteo corre en la base, ponderado por participaciones.
-- =============================================================================

create type public.giveaway_entry_mode as enum ('free', 'tickets');
create type public.giveaway_status as enum ('draft', 'published');
create type public.winner_status as enum ('pending', 'contacted', 'delivered', 'void');

create table public.giveaways (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 80),
  prize text not null check (length(trim(prize)) between 1 and 120),
  description text check (length(description) <= 2000),
  image_path text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status public.giveaway_status not null default 'draft',
  entry_mode public.giveaway_entry_mode not null default 'free',
  max_tickets_per_user integer not null default 1 check (max_tickets_per_user between 1 and 1000),
  winners_count integer not null default 1 check (winners_count between 1 and 100),
  min_level integer not null default 1 check (min_level >= 1),
  -- Si está, hay que tener una cuenta verificada en ese casino.
  casino_id uuid references public.casinos (id) on delete set null,
  drawn_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index giveaways_published_idx on public.giveaways (ends_at desc) where status = 'published';

create trigger giveaways_touch_updated_at
  before update on public.giveaways
  for each row execute function public.touch_updated_at();

create table public.giveaway_entries (
  giveaway_id uuid not null references public.giveaways (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  entries integer not null check (entries > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (giveaway_id, user_id)
);

create trigger giveaway_entries_touch_updated_at
  before update on public.giveaway_entries
  for each row execute function public.touch_updated_at();

create table public.giveaway_winners (
  giveaway_id uuid not null references public.giveaways (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  position integer not null check (position > 0),
  status public.winner_status not null default 'pending',
  drawn_at timestamptz not null default now(),
  primary key (giveaway_id, user_id)
);

-- Participar (o sumar tickets). En modo gratis es una sola participación.
create function public.enter_giveaway(p_giveaway uuid, p_tickets integer default 1)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_giveaway public.giveaways%rowtype;
  v_profile public.profiles%rowtype;
  v_current integer;
  v_add integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  select * into v_giveaway from public.giveaways g
   where g.id = p_giveaway and g.status = 'published' and g.starts_at <= now() and g.ends_at > now();
  if v_giveaway.id is null then
    raise exception 'giveaway_closed' using errcode = '22023';
  end if;
  select * into v_profile from public.profiles p where p.id = v_uid for update;
  if v_profile.level < v_giveaway.min_level then
    raise exception 'level_too_low' using errcode = '22023';
  end if;
  if v_giveaway.casino_id is not null and not exists (
    select 1 from public.casino_accounts a
     where a.user_id = v_uid and a.casino_id = v_giveaway.casino_id and a.status = 'approved'
  ) then
    raise exception 'casino_not_verified' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('giveaway_entry', 10, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  select e.entries into v_current from public.giveaway_entries e
   where e.giveaway_id = p_giveaway and e.user_id = v_uid for update;
  v_current := coalesce(v_current, 0);

  if v_giveaway.entry_mode = 'free' then
    if v_current > 0 then
      raise exception 'already_entered' using errcode = '22023';
    end if;
    v_add := 1;
  else
    v_add := least(greatest(coalesce(p_tickets, 1), 1), v_giveaway.max_tickets_per_user - v_current);
    if v_add <= 0 then
      raise exception 'max_tickets_reached' using errcode = '22023';
    end if;
    if v_profile.tickets < v_add then
      raise exception 'not_enough_tickets' using errcode = '22023';
    end if;
    update public.profiles set tickets = tickets - v_add where id = v_uid;
  end if;

  insert into public.giveaway_entries (giveaway_id, user_id, entries)
  values (p_giveaway, v_uid, v_add)
  on conflict (giveaway_id, user_id) do update set entries = public.giveaway_entries.entries + excluded.entries;
  return v_current + v_add;
end;
$$;

-- Sortea `p_count` ganadores nuevos (sin repetir y sin baneados), ponderado por
-- participaciones (Efraimidis–Spirakis: menor -ln(u)/peso gana).
create function public.draw_giveaway(p_giveaway uuid, p_count integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_giveaway public.giveaways%rowtype;
  v_count integer;
  v_next integer;
  v_drawn integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_giveaway from public.giveaways g where g.id = p_giveaway for update;
  if v_giveaway.id is null or v_giveaway.status <> 'published' then
    raise exception 'not_found' using errcode = '22023';
  end if;

  select coalesce(max(w.position), 0) + 1 into v_next from public.giveaway_winners w where w.giveaway_id = p_giveaway;
  v_count := coalesce(
    p_count,
    v_giveaway.winners_count - (
      select count(*) from public.giveaway_winners w where w.giveaway_id = p_giveaway and w.status <> 'void'
    )
  );
  if v_count <= 0 then
    raise exception 'nothing_to_draw' using errcode = '22023';
  end if;

  with candidates as (
    select e.user_id, -ln(1 - random()) / e.entries as score
      from public.giveaway_entries e
      join public.profiles p on p.id = e.user_id and p.banned_at is null
     where e.giveaway_id = p_giveaway
       and not exists (select 1 from public.giveaway_winners w where w.giveaway_id = p_giveaway and w.user_id = e.user_id)
     order by score
     limit v_count
  ),
  inserted as (
    insert into public.giveaway_winners (giveaway_id, user_id, position)
    select p_giveaway, c.user_id, v_next + row_number() over (order by c.score) - 1 from candidates c
    returning 1
  )
  select count(*) into v_drawn from inserted;

  if v_drawn = 0 then
    raise exception 'no_entries' using errcode = '22023';
  end if;
  update public.giveaways set drawn_at = now() where id = p_giveaway;
  return v_drawn;
end;
$$;

create function public.set_winner_status(p_giveaway uuid, p_user uuid, p_status public.winner_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.giveaway_winners set status = p_status where giveaway_id = p_giveaway and user_id = p_user;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
end;
$$;

-- Participantes y chances totales de un sorteo publicado.
create function public.giveaway_stats(p_giveaway uuid)
returns table (participants integer, entries integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer, coalesce(sum(e.entries), 0)::integer
    from public.giveaway_entries e
    join public.giveaways g on g.id = e.giveaway_id and (g.status = 'published' or public.is_admin())
   where e.giveaway_id = p_giveaway;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.giveaways enable row level security;
alter table public.giveaway_entries enable row level security;
alter table public.giveaway_winners enable row level security;

create policy "giveaways_select" on public.giveaways
  for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "giveaways_admin_write" on public.giveaways
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "giveaway_entries_select_own_or_admin" on public.giveaway_entries
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Los ganadores de un sorteo publicado son públicos (sin los anulados).
create policy "giveaway_winners_select" on public.giveaway_winners
  for select to anon, authenticated
  using (
    public.is_admin()
    or (status <> 'void' and exists (select 1 from public.giveaways g where g.id = giveaway_id and g.status = 'published'))
  );

revoke all on public.giveaway_entries from anon;
revoke insert, update, delete on public.giveaway_entries, public.giveaway_winners from anon, authenticated;
revoke insert, update, delete on public.giveaways from anon;

revoke execute on function public.enter_giveaway(uuid, integer) from public, anon;
revoke execute on function public.draw_giveaway(uuid, integer) from public, anon;
revoke execute on function public.set_winner_status(uuid, uuid, public.winner_status) from public, anon;
grant execute on function public.enter_giveaway(uuid, integer) to authenticated;
grant execute on function public.draw_giveaway(uuid, integer) to authenticated;
grant execute on function public.set_winner_status(uuid, uuid, public.winner_status) to authenticated;
grant execute on function public.giveaway_stats(uuid) to anon, authenticated;
