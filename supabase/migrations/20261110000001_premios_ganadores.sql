-- =============================================================================
-- Premios «Ganador Bonus Hunt» y «Ganador Bonus Buy»: al terminar el hunt (o la
-- sesión de Bonus Buy), el viewer cuyo call pagó el mejor multi se lleva puntos y
-- XP (configurables en Panel → Puntos) y una notificación. Empate: el de mayor
-- pago y, si sigue igual, el que entró primero. Se cobra una sola vez por hunt.
-- También se corrige el texto de la notificación: «Bonus Buy» va sin S.
-- =============================================================================

update public.site_settings
   set value = value
     || jsonb_build_object('hunt_winner', coalesce(value -> 'hunt_winner', '{"points": 200, "xp": 100}'::jsonb))
     || jsonb_build_object('buy_winner', coalesce(value -> 'buy_winner', '{"points": 200, "xp": 100}'::jsonb))
 where key = 'rewards';

create function public.reward_session_winner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_best record;
  v_kind text;
  v_link text;
  v_title text;
begin
  if new.status <> 'finished' or old.status = 'finished' then
    return null;
  end if;

  if tg_table_name = 'hunts' then
    select b.called_by, b.slot_name, b.multi into v_best
      from public.hunt_bonuses b
     where b.hunt_id = new.id and b.called_by is not null and b.multi is not null
     order by b.multi desc, b.payout desc, b.position
     limit 1;
    v_kind := 'hunt_winner';
    v_link := '/bonus-hunt/' || new.id;
    v_title := '¡Ganaste el Bonus Hunt!';
  else
    select b.called_by, b.slot_name, b.multi into v_best
      from public.buys b
     where b.session_id = new.id and b.called_by is not null and b.multi is not null
     order by b.multi desc, b.payout desc, b.position
     limit 1;
    v_kind := 'buy_winner';
    v_link := '/bonus-buys/' || new.id;
    v_title := '¡Ganaste el Bonus Buy!';
  end if;

  if v_best.called_by is not null then
    perform public.award_reward(v_best.called_by, v_kind, new.id);
    -- Si se reabre y se vuelve a terminar, no se avisa de nuevo.
    if exists (
      select 1 from public.notifications n
       where n.user_id = v_best.called_by and n.kind = v_kind and n.link = v_link
    ) then
      return null;
    end if;
    perform public.notify('user', v_best.called_by, v_kind, v_title,
      'Tu call ' || v_best.slot_name || ' fue el mejor de ' || new.title || ': ' || public.format_multi(v_best.multi) || '.',
      v_link);
  end if;
  return null;
end;
$$;

create trigger hunts_reward_winner
  after update of status on public.hunts
  for each row execute function public.reward_session_winner();

create trigger buy_sessions_reward_winner
  after update of status on public.buy_sessions
  for each row execute function public.reward_session_winner();

revoke execute on function public.reward_session_winner() from public, anon, authenticated;

-- «Arrancó el Bonus Buy» (antes decía «Arrancaron los Bonus Buys»).
create or replace function public.notify_started()
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
    perform public.notify('all', null, 'buys_started', 'Arrancó un Bonus Buy', new.title || ' · pedí tu slot',
      '/bonus-buys/' || new.id);
  elsif tg_table_name = 'battles' then
    perform public.notify('all', null, 'battle_started', 'Arrancó una Bonus Battle', new.title || ' · calleá tu slot',
      '/bonus-battle/' || new.id);
  elsif tg_table_name = 'wager_races' then
    perform public.notify('all', null, 'race_started', 'Nueva Wager Race', new.title, '/wager-race/' || new.id);
  elsif tg_table_name = 'giveaways' then
    perform public.notify('all', null, 'giveaway_started', 'Nuevo sorteo', new.title, '/sorteos');
  end if;
  return null;
end;
$$;
