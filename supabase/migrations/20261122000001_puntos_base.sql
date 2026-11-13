-- =============================================================================
-- Puntos, etapa 1: base.
-- - Valores de puntos configurables (ver, chat, bonus diario, follow, sub, bits).
-- - Bonus diario en la web con racha.
-- - Bloqueo del sistema de puntos por usuario (aparte del ban).
-- - Cuentas nuevas: acumulan, pero no canjean ni entran a sorteos.
-- - Ranking de puntos semanal e histórico.
-- Los puntos no se compran ni se cambian por plata: es fidelidad de comunidad.
-- =============================================================================

insert into public.site_settings (key, value, is_public) values
  ('points_config', '{
    "watch_points": 10,
    "watch_interval_minutes": 5,
    "chat_points": 2,
    "chat_per_minute": 1,
    "daily_points": 50,
    "daily_streak_step_pct": 10,
    "daily_streak_cap_pct": 100,
    "follow_points": 200,
    "sub_points": 1500,
    "gift_sub_points": 1000,
    "bit_points": 1
  }'::jsonb, true),
  ('points_min_account_age_days', '7'::jsonb, true)
on conflict (key) do nothing;

-- Un valor de `points_config`, con su valor de fábrica si falta o es inválido.
create function public.points_setting(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case when jsonb_typeof(s.value -> p_key) = 'number' then greatest((s.value ->> p_key)::numeric, 0)::integer end
       from public.site_settings s where s.key = 'points_config'),
    p_default
  );
$$;

-- -----------------------------------------------------------------------------
-- Perfil: total ganado (para el ranking histórico), bloqueo de puntos y racha.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column points_earned integer not null default 0 check (points_earned >= 0),
  add column points_blocked_at timestamptz,
  add column points_block_reason text check (length(points_block_reason) <= 200),
  add column daily_streak integer not null default 0 check (daily_streak >= 0),
  add column daily_last_claim date;

-- Los reintegros devuelven puntos gastados: no son puntos ganados.
create function public.point_kind_earns(p_kind text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_kind not like '%\_refund';
$$;

update public.profiles p
   set points_earned = e.total
  from (
    select user_id, sum(points)::integer as total
      from public.point_events
     where points > 0 and public.point_kind_earns(kind)
     group by user_id
  ) e
 where e.user_id = p.id;

-- -----------------------------------------------------------------------------
-- Libro de puntos: referencia de texto (un día, un evento de Twitch) para que el
-- mismo motivo no se acredite dos veces.
-- -----------------------------------------------------------------------------
alter table public.point_events add column source_ref text check (length(source_ref) <= 120);

create unique index point_events_once_ref_idx on public.point_events (user_id, kind, source_ref)
  where source_ref is not null;
create index point_events_week_idx on public.point_events (created_at) where points > 0;

drop function public.apply_points(uuid, text, uuid, integer, integer, text);

-- Suma (o resta) puntos y XP y recalcula el nivel. Uso interno: devuelve false si ya estaba
-- o si el usuario está bloqueado del sistema de puntos (los reintegros y ajustes pasan igual).
create function public.apply_points(
  p_user uuid,
  p_kind text,
  p_source uuid,
  p_points integer,
  p_xp integer,
  p_note text default null,
  p_ref text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_points integer := coalesce(p_points, 0);
  v_xp integer := greatest(coalesce(p_xp, 0), 0);
  v_earned integer := case when coalesce(p_points, 0) > 0 and public.point_kind_earns(p_kind) then p_points else 0 end;
begin
  if p_user is null or (v_points = 0 and v_xp = 0) then
    return false;
  end if;
  if v_earned > 0 and p_kind <> 'admin_adjust' and exists (
    select 1 from public.profiles p where p.id = p_user and p.points_blocked_at is not null
  ) then
    return false;
  end if;

  insert into public.point_events (user_id, kind, source_id, source_ref, points, xp, note, created_by)
  values (p_user, p_kind, p_source, p_ref, v_points, v_xp, p_note, auth.uid())
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    return false;
  end if;

  update public.profiles
     set points = greatest(points + v_points, 0),
         points_earned = points_earned + v_earned,
         xp = xp + v_xp,
         level = public.level_for_xp(xp + v_xp)
   where id = p_user;
  return true;
end;
$$;

revoke execute on function public.apply_points(uuid, text, uuid, integer, integer, text, text)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Bloqueo del sistema de puntos (el admin): deja de sumar y no puede canjear.
-- -----------------------------------------------------------------------------
create function public.set_points_block(p_user uuid, p_blocked boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.profiles
     set points_blocked_at = case when p_blocked then coalesce(points_blocked_at, now()) else null end,
         points_block_reason = case when p_blocked then nullif(left(trim(coalesce(p_reason, '')), 200), '') else null end
   where id = p_user;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cuentas nuevas y bloqueados: acumulan (los nuevos), pero no canjean ni entran a
-- sorteos o predicciones. Si no se conoce la antigüedad en Twitch, vale la de la web.
-- -----------------------------------------------------------------------------
create function public.assert_can_redeem(p_check_block boolean default true)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_days integer := public.setting_int('points_min_account_age_days', 7);
begin
  select * into v_profile from public.profiles p where p.id = auth.uid();
  if v_profile.id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_check_block and v_profile.points_blocked_at is not null then
    raise exception 'points_blocked' using errcode = '42501';
  end if;
  if v_days > 0
     and coalesce(v_profile.twitch_created_at, v_profile.created_at) > now() - make_interval(days => v_days) then
    raise exception 'account_too_new' using errcode = '42501';
  end if;
end;
$$;

-- Canjes de la tienda: los crea el propio viewer con buy_shop_item.
create function public.shop_orders_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id = auth.uid() then
    perform public.assert_can_redeem(true);
  end if;
  return new;
end;
$$;

create trigger shop_orders_guard
  before insert on public.shop_orders
  for each row execute function public.shop_orders_guard();

-- Sorteos: el bloqueo de puntos no impide los gratis; la antigüedad sí.
create function public.giveaway_entries_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id = auth.uid() and (tg_op = 'INSERT' or new.entries > old.entries) then
    perform public.assert_can_redeem(false);
  end if;
  return new;
end;
$$;

create trigger giveaway_entries_guard
  before insert or update of entries on public.giveaway_entries
  for each row execute function public.giveaway_entries_guard();

-- -----------------------------------------------------------------------------
-- Bonus diario con racha. El día cambia a las 00:00 de Argentina.
-- -----------------------------------------------------------------------------
create function public.ar_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- Cuánto paga el bonus en el día N de racha (N desde 1).
create function public.daily_bonus_points(p_streak integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    public.points_setting('daily_points', 50)
    * (1 + least(
        greatest(coalesce(p_streak, 1) - 1, 0) * public.points_setting('daily_streak_step_pct', 10),
        public.points_setting('daily_streak_cap_pct', 100)
      ) / 100.0)
  )::integer;
$$;

create function public.claim_daily_bonus()
returns table (points integer, streak integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_today date := public.ar_today();
  v_streak integer;
  v_points integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  select * into v_profile from public.profiles p where p.id = v_uid for update;
  if v_profile.points_blocked_at is not null then
    raise exception 'points_blocked' using errcode = '42501';
  end if;
  if v_profile.daily_last_claim = v_today then
    raise exception 'already_claimed' using errcode = '22023';
  end if;

  v_streak := case when v_profile.daily_last_claim = v_today - 1 then v_profile.daily_streak + 1 else 1 end;
  v_points := public.daily_bonus_points(v_streak);
  -- El día es la referencia del movimiento: aunque algo falle, no se paga dos veces.
  if v_points > 0 and not public.apply_points(
    v_uid, 'daily_bonus', null, v_points, v_points, 'Día ' || v_streak || ' de racha', to_char(v_today, 'YYYY-MM-DD')
  ) then
    raise exception 'already_claimed' using errcode = '22023';
  end if;
  update public.profiles set daily_streak = v_streak, daily_last_claim = v_today where id = v_uid;
  return query select v_points, v_streak;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ranking de puntos: de la semana (desde el lunes 00:00 de Argentina) o histórico.
-- Solo expone nick, avatar, nivel y puntos. Baneados y bloqueados no figuran.
-- -----------------------------------------------------------------------------
create function public.ar_week_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')
           at time zone 'America/Argentina/Buenos_Aires';
$$;

create function public.points_leaderboard(p_period text default 'all', p_limit integer default 10)
returns table (id uuid, display_name text, twitch_login text, avatar_url text, level integer, points integer)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select e.user_id, sum(e.points)::integer as total
      from public.point_events e
     where p_period = 'week'
       and e.points > 0
       and public.point_kind_earns(e.kind)
       and e.created_at >= public.ar_week_start()
     group by e.user_id
    union all
    select p.id, p.points_earned
      from public.profiles p
     where p_period <> 'week' and p.points_earned > 0
  )
  select p.id, p.display_name, p.twitch_login, p.avatar_url, p.level, t.total
    from totals t
    join public.profiles p on p.id = t.user_id
   where p.banned_at is null and p.points_blocked_at is null
   order by t.total desc, p.created_at
   limit least(greatest(coalesce(p_limit, 10), 1), 100);
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on function public.shop_orders_guard() from public, anon, authenticated;
revoke execute on function public.giveaway_entries_guard() from public, anon, authenticated;
revoke execute on function public.assert_can_redeem(boolean) from public, anon;
revoke execute on function public.set_points_block(uuid, boolean, text) from public, anon;
revoke execute on function public.claim_daily_bonus() from public, anon;
grant execute on function public.assert_can_redeem(boolean) to authenticated;
grant execute on function public.set_points_block(uuid, boolean, text) to authenticated;
grant execute on function public.claim_daily_bonus() to authenticated;
grant execute on function public.points_setting(text, integer) to anon, authenticated;
grant execute on function public.daily_bonus_points(integer) to anon, authenticated;
grant execute on function public.points_leaderboard(text, integer) to anon, authenticated;
