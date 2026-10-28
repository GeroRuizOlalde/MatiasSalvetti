-- =============================================================================
-- Cuartel: puntos y XP (historial idempotente), premios automáticos por
-- participar, misiones y tienda.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Niveles: misma curva que src/lib/calc/levels.ts (setting level_curve).
-- -----------------------------------------------------------------------------
create function public.level_for_xp(p_xp integer)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base numeric;
  v_exp numeric;
  v_level integer := 1;
  v_rem bigint := greatest(coalesce(p_xp, 0), 0);
  v_need bigint;
begin
  select (s.value ->> 'base')::numeric, (s.value ->> 'exponent')::numeric
    into v_base, v_exp
    from public.site_settings s where s.key = 'level_curve';
  if v_base is null or v_base <= 0 or v_exp is null or v_exp <= 0 then
    v_base := 300;
    v_exp := 1.15;
  end if;
  while v_level < 1000 loop
    v_need := round(v_base * power(v_level::numeric, v_exp));
    exit when v_rem < v_need;
    v_rem := v_rem - v_need;
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;

-- -----------------------------------------------------------------------------
-- Historial de puntos y XP. Un mismo (usuario, motivo, origen) cuenta una sola vez.
-- -----------------------------------------------------------------------------
create table public.point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{2,40}$'),
  source_id uuid,
  points integer not null default 0,
  xp integer not null default 0 check (xp >= 0),
  note text check (length(note) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index point_events_once_idx on public.point_events (user_id, kind, source_id) where source_id is not null;
create index point_events_user_idx on public.point_events (user_id, created_at desc);

-- Premios por defecto de cada motivo. El admin los cambia desde el panel.
insert into public.site_settings (key, value, is_public) values
  ('rewards', '{
    "hunt_call": {"points": 50, "xp": 40},
    "gtb_participation": {"points": 10, "xp": 15},
    "gtb_win": {"points": 300, "xp": 150},
    "buy_vote": {"points": 5, "xp": 10},
    "battle_pick": {"points": 10, "xp": 15},
    "battle_champion": {"points": 150, "xp": 80}
  }'::jsonb, true)
on conflict (key) do nothing;

-- Suma (o resta) puntos y XP y recalcula el nivel. Uso interno: devuelve false si ya estaba.
create function public.apply_points(
  p_user uuid,
  p_kind text,
  p_source uuid,
  p_points integer,
  p_xp integer,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_user is null or (coalesce(p_points, 0) = 0 and coalesce(p_xp, 0) = 0) then
    return false;
  end if;
  insert into public.point_events (user_id, kind, source_id, points, xp, note, created_by)
  values (p_user, p_kind, p_source, coalesce(p_points, 0), greatest(coalesce(p_xp, 0), 0), p_note, auth.uid())
  on conflict (user_id, kind, source_id) where source_id is not null do nothing
  returning id into v_id;
  if v_id is null then
    return false;
  end if;

  update public.profiles
     set points = greatest(points + coalesce(p_points, 0), 0),
         xp = xp + greatest(coalesce(p_xp, 0), 0),
         level = public.level_for_xp(xp + greatest(coalesce(p_xp, 0), 0))
   where id = p_user;
  return true;
end;
$$;

-- Premio configurado para un motivo. Los baneados no suman.
create function public.award_reward(p_user uuid, p_kind text, p_source uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reward jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id = p_user and p.banned_at is null) then
    return false;
  end if;
  select s.value -> p_kind into v_reward from public.site_settings s where s.key = 'rewards';
  if v_reward is null then
    return false;
  end if;
  return public.apply_points(
    p_user, p_kind, p_source,
    coalesce((v_reward ->> 'points')::integer, 0),
    coalesce((v_reward ->> 'xp')::integer, 0)
  );
end;
$$;

-- Ajuste manual del admin (positivo o negativo).
create function public.admin_adjust_points(p_user uuid, p_points integer, p_xp integer, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'note_required' using errcode = '22023';
  end if;
  perform public.apply_points(p_user, 'admin_adjust', null, p_points, greatest(coalesce(p_xp, 0), 0), left(trim(p_note), 200));
end;
$$;

-- -----------------------------------------------------------------------------
-- Premios automáticos por participar
-- -----------------------------------------------------------------------------

-- Call aceptado en un hunt.
create function public.reward_hunt_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.award_reward(new.user_id, 'hunt_call', new.id);
  end if;
  return null;
end;
$$;

create trigger hunt_calls_reward
  after update of status on public.hunt_calls
  for each row execute function public.reward_hunt_call();

-- Hunt terminado: todos los que apostaron en el GTB y, aparte, el ganador.
create function public.reward_hunt_finished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if new.status = 'finished' and old.status <> 'finished' then
    for v_user in select g.user_id from public.hunt_guesses g where g.hunt_id = new.id loop
      perform public.award_reward(v_user, 'gtb_participation', new.id);
    end loop;
    if new.gtb_winner_id is not null then
      perform public.award_reward(new.gtb_winner_id, 'gtb_win', new.id);
    end if;
  end if;
  return null;
end;
$$;

create trigger hunts_reward
  after update of status on public.hunts
  for each row execute function public.reward_hunt_finished();

-- Votación de Buys cerrada: todos los que votaron.
create function public.reward_buy_poll_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if old.is_open and not new.is_open then
    for v_user in select v.user_id from public.buy_poll_votes v where v.poll_id = new.id loop
      perform public.award_reward(v_user, 'buy_vote', new.id);
    end loop;
  end if;
  return null;
end;
$$;

create trigger buy_polls_reward
  after update of is_open on public.buy_polls
  for each row execute function public.reward_buy_poll_closed();

-- Battle terminada: todos los que bancaron y, aparte, los que bancaron al campeón.
create function public.reward_battle_finished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pick record;
begin
  if new.status = 'finished' and old.status <> 'finished' then
    for v_pick in select p.user_id, p.entry_id from public.battle_picks p where p.battle_id = new.id loop
      perform public.award_reward(v_pick.user_id, 'battle_pick', new.id);
      if v_pick.entry_id = new.winner_entry_id then
        perform public.award_reward(v_pick.user_id, 'battle_champion', new.id);
      end if;
    end loop;
  end if;
  return null;
end;
$$;

create trigger battles_reward
  after update of status on public.battles
  for each row execute function public.reward_battle_finished();

-- -----------------------------------------------------------------------------
-- Misiones
-- -----------------------------------------------------------------------------
create type public.mission_type as enum ('daily', 'code', 'link');

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 80),
  description text check (length(description) <= 300),
  type public.mission_type not null,
  points integer not null default 0 check (points between 0 and 100000),
  xp integer not null default 0 check (xp between 0 and 100000),
  url text check (url is null or url ~ '^https://'),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'link' or url is not null),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create trigger missions_touch_updated_at
  before update on public.missions
  for each row execute function public.touch_updated_at();

-- La palabra secreta va aparte: la tabla de misiones la lee cualquiera.
create table public.mission_codes (
  mission_id uuid primary key references public.missions (id) on delete cascade,
  code text not null check (length(trim(code)) between 2 and 40)
);

create table public.mission_claims (
  mission_id uuid not null references public.missions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 'once' para las de una sola vez; la fecha (hora AR) para las diarias.
  claim_key text not null,
  created_at timestamptz not null default now(),
  primary key (mission_id, user_id, claim_key)
);

create function public.claim_mission(p_mission uuid, p_code text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_key text;
  v_event uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  select * into v_mission from public.missions m
   where m.id = p_mission and m.is_active
     and (m.starts_at is null or m.starts_at <= now())
     and (m.ends_at is null or m.ends_at > now());
  if v_mission.id is null then
    raise exception 'mission_unavailable' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('mission_claim', 10, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  if v_mission.type = 'code' and not exists (
    select 1 from public.mission_codes c
     where c.mission_id = p_mission and lower(trim(c.code)) = lower(trim(coalesce(p_code, '')))
  ) then
    raise exception 'wrong_code' using errcode = '22023';
  end if;

  v_key := case when v_mission.type = 'daily'
                then to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD')
                else 'once' end;
  insert into public.mission_claims (mission_id, user_id, claim_key)
  values (p_mission, v_uid, v_key)
  on conflict do nothing;
  if not found then
    raise exception 'already_claimed' using errcode = '22023';
  end if;

  -- Cada reclamo es su propio origen, así las diarias suman todos los días.
  v_event := gen_random_uuid();
  perform public.apply_points(v_uid, 'mission', v_event, v_mission.points, v_mission.xp, v_mission.title);
end;
$$;

-- -----------------------------------------------------------------------------
-- Tienda
-- -----------------------------------------------------------------------------
create type public.shop_item_kind as enum ('reward', 'tickets');
create type public.order_status as enum ('pending', 'delivered', 'cancelled');

create table public.shop_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 80),
  description text check (length(description) <= 500),
  image_path text,
  kind public.shop_item_kind not null default 'reward',
  -- Para 'tickets': cuántos tickets de sorteo da.
  tickets integer check (tickets is null or tickets > 0),
  cost integer not null check (cost > 0),
  stock integer check (stock is null or stock >= 0),
  per_user_limit integer check (per_user_limit is null or per_user_limit > 0),
  min_level integer not null default 1 check (min_level >= 1),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'tickets' or tickets is not null)
);

create trigger shop_items_touch_updated_at
  before update on public.shop_items
  for each row execute function public.touch_updated_at();

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.shop_items (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_title text not null,
  cost integer not null,
  status public.order_status not null,
  note text check (length(note) <= 300),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index shop_orders_pending_idx on public.shop_orders (created_at) where status = 'pending';
create index shop_orders_user_idx on public.shop_orders (user_id, created_at desc);

create function public.buy_shop_item(p_item uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.shop_items%rowtype;
  v_profile public.profiles%rowtype;
  v_order uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  select * into v_item from public.shop_items i where i.id = p_item and i.is_active for update;
  if v_item.id is null then
    raise exception 'item_unavailable' using errcode = '22023';
  end if;
  if v_item.stock is not null and v_item.stock <= 0 then
    raise exception 'out_of_stock' using errcode = '22023';
  end if;
  if v_item.per_user_limit is not null and (
    select count(*) from public.shop_orders o
     where o.item_id = p_item and o.user_id = v_uid and o.status <> 'cancelled'
  ) >= v_item.per_user_limit then
    raise exception 'limit_reached' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles p where p.id = v_uid for update;
  if v_profile.level < v_item.min_level then
    raise exception 'level_too_low' using errcode = '22023';
  end if;
  if v_profile.points < v_item.cost then
    raise exception 'not_enough_points' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('shop_buy', 5, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  insert into public.shop_orders (item_id, user_id, item_title, cost, status)
  values (p_item, v_uid, v_item.title, v_item.cost,
          case when v_item.kind = 'tickets' then 'delivered'::public.order_status else 'pending' end)
  returning id into v_order;

  perform public.apply_points(v_uid, 'shop', v_order, -v_item.cost, 0, v_item.title);
  if v_item.kind = 'tickets' then
    update public.profiles set tickets = tickets + v_item.tickets where id = v_uid;
  end if;
  if v_item.stock is not null then
    update public.shop_items set stock = stock - 1 where id = p_item;
  end if;
  return v_order;
end;
$$;

-- El admin entrega un canje o lo cancela (con reintegro de puntos y stock).
create function public.handle_shop_order(p_order uuid, p_deliver boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.shop_orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_order from public.shop_orders o where o.id = p_order for update;
  if v_order.id is null or v_order.status <> 'pending' then
    raise exception 'order_not_pending' using errcode = '22023';
  end if;

  update public.shop_orders
     set status = case when p_deliver then 'delivered'::public.order_status else 'cancelled' end,
         note = nullif(left(trim(coalesce(p_note, '')), 300), ''),
         handled_by = auth.uid(),
         handled_at = now()
   where id = p_order;

  if not p_deliver then
    perform public.apply_points(v_order.user_id, 'shop_refund', p_order, v_order.cost, 0, v_order.item_title);
    update public.shop_items set stock = stock + 1 where id = v_order.item_id and stock is not null;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.point_events enable row level security;
alter table public.missions enable row level security;
alter table public.mission_codes enable row level security;
alter table public.mission_claims enable row level security;
alter table public.shop_items enable row level security;
alter table public.shop_orders enable row level security;

create policy "point_events_select_own_or_admin" on public.point_events
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy "missions_select" on public.missions
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "missions_admin_write" on public.missions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "mission_codes_admin" on public.mission_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "mission_claims_select_own_or_admin" on public.mission_claims
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy "shop_items_select" on public.shop_items
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "shop_items_admin_write" on public.shop_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "shop_orders_select_own_or_admin" on public.shop_orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on public.point_events, public.mission_claims, public.shop_orders, public.mission_codes from anon;
revoke insert, update, delete on public.point_events, public.mission_claims, public.shop_orders from authenticated;
revoke insert, update, delete on public.missions, public.shop_items from anon;

revoke execute on function public.apply_points(uuid, text, uuid, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.award_reward(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.reward_hunt_call() from public, anon, authenticated;
revoke execute on function public.reward_hunt_finished() from public, anon, authenticated;
revoke execute on function public.reward_buy_poll_closed() from public, anon, authenticated;
revoke execute on function public.reward_battle_finished() from public, anon, authenticated;
revoke execute on function public.admin_adjust_points(uuid, integer, integer, text) from public, anon;
revoke execute on function public.claim_mission(uuid, text) from public, anon;
revoke execute on function public.buy_shop_item(uuid) from public, anon;
revoke execute on function public.handle_shop_order(uuid, boolean, text) from public, anon;
grant execute on function public.admin_adjust_points(uuid, integer, integer, text) to authenticated;
grant execute on function public.claim_mission(uuid, text) to authenticated;
grant execute on function public.buy_shop_item(uuid) to authenticated;
grant execute on function public.handle_shop_order(uuid, boolean, text) to authenticated;
grant execute on function public.level_for_xp(integer) to anon, authenticated;
