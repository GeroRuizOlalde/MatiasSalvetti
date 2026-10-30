-- =============================================================================
-- Multi a mano: si no se cargan apuesta y pago, el viewer puede poner el multi
-- directo (ej. 2500x). Con apuesta y pago, el multi se calcula solo.
--
-- Editar replays. El autor puede corregir su replay y el panel puede editar
-- cualquiera.
-- - Slot, montos y comentario se cambian sin volver a revisión.
-- - Si el autor cambia el link, o edita uno rechazado, el replay vuelve a
--   «En revisión» para que el panel lo mire de nuevo.
-- =============================================================================

alter table public.replays add column edited_at timestamptz;

create function public.update_replay(
  p_id uuid,
  p_url text,
  p_slot uuid default null,
  p_slot_name text default null,
  p_note text default null,
  p_currency public.currency_code default 'ARS',
  p_bet numeric default null,
  p_bonus_cost numeric default null,
  p_payout numeric default null,
  p_multi numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_replay public.replays%rowtype;
  v_is_mod boolean := public.is_mod();
  v_url text := trim(coalesce(p_url, ''));
  v_host text;
  v_name text := left(trim(coalesce(p_slot_name, '')), 120);
  v_slot uuid := null;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_review boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_replay from public.replays r where r.id = p_id for update;
  if v_replay.id is null then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if not v_is_mod and (v_replay.user_id <> v_uid or not public.can_participate()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if length(v_url) > 500 or v_url !~* '^https://([a-z0-9-]+\.)+[a-z]{2,}(:[0-9]+)?(/[^[:space:]]*)?$' then
    raise exception 'invalid_url' using errcode = '22023';
  end if;
  v_host := lower(substring(v_url from '^https://([^/:?#]+)'));
  v_host := regexp_replace(v_host, '^www\.', '');

  if p_slot is not null then
    select s.id, s.name into v_slot, v_name from public.slots s where s.id = p_slot and s.is_active;
    if v_slot is null then
      raise exception 'invalid_slot' using errcode = '22023';
    end if;
  end if;
  if length(v_name) = 0 then
    raise exception 'invalid_slot' using errcode = '22023';
  end if;
  if (p_bet is not null and (p_bet <= 0 or p_bet > 999999999999))
     or (p_bonus_cost is not null and (p_bonus_cost <= 0 or p_bonus_cost > 999999999999))
     or (p_payout is not null and (p_payout < 0 or p_payout > 999999999999)) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_multi is not null and (p_multi <= 0 or p_multi > 9999999999) then
    raise exception 'invalid_multi' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 200 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;
  if v_url <> v_replay.url and exists (select 1 from public.replays r where r.url = v_url and r.id <> p_id) then
    raise exception 'replay_duplicate' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('replay_edit', 10, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  -- El panel no se manda a revisar a sí mismo.
  v_review := not v_is_mod and v_replay.status <> 'pending'
    and (v_url <> v_replay.url or v_replay.status = 'rejected');

  update public.replays
     set url = v_url,
         host = v_host,
         slot_id = v_slot,
         slot_name = v_name,
         note = v_note,
         currency = coalesce(p_currency, 'ARS'),
         bet = p_bet,
         bonus_cost = p_bonus_cost,
         payout = p_payout,
         multi = case when p_bet > 0 and p_payout is not null then round(p_payout / p_bet, 2) else p_multi end,
         edited_at = now(),
         status = case when v_review then 'pending' else status end,
         reject_reason = case when v_review then null else reject_reason end,
         reviewed_by = case when v_review then null else reviewed_by end,
         reviewed_at = case when v_review then null else reviewed_at end
   where id = p_id;
end;
$$;

-- Avisos: se suma el de un replay editado que vuelve a revisión.
create or replace function public.notify_replay()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify('panel', null, 'replay_new', 'Nuevo replay',
      public.viewer_name(new.user_id) || ' compartió un replay de ' || new.slot_name,
      '/panel/replays');
  elsif old.status <> new.status and new.status = 'pending' then
    perform public.notify('panel', null, 'replay_new', 'Replay editado para revisar',
      public.viewer_name(new.user_id) || ' editó su replay de ' || new.slot_name,
      '/panel/replays');
  elsif old.status <> new.status and new.status = 'approved' then
    perform public.notify('user', new.user_id, 'replay_approved', 'Tu replay está publicado',
      new.slot_name || ' ya se ve en Replays.', '/replays');
  elsif old.status <> new.status and new.status = 'rejected' then
    perform public.notify('user', new.user_id, 'replay_rejected', 'Tu replay no se publicó',
      coalesce(new.reject_reason, new.slot_name || ' no se publicó.'), '/replays');
  end if;
  return null;
end;
$$;

revoke execute on function public.update_replay(uuid, text, uuid, text, text, public.currency_code, numeric, numeric, numeric, numeric)
  from public, anon;
grant execute on function public.update_replay(uuid, text, uuid, text, text, public.currency_code, numeric, numeric, numeric, numeric)
  to authenticated;

-- Mandar un replay: igual que antes, más el multi a mano.
drop function public.submit_replay(text, uuid, text, text, public.currency_code, numeric, numeric, numeric);

create function public.submit_replay(
  p_url text,
  p_slot uuid default null,
  p_slot_name text default null,
  p_note text default null,
  p_currency public.currency_code default 'ARS',
  p_bet numeric default null,
  p_bonus_cost numeric default null,
  p_payout numeric default null,
  p_multi numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_url text := trim(coalesce(p_url, ''));
  v_host text;
  v_name text := left(trim(coalesce(p_slot_name, '')), 120);
  v_slot uuid := null;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;

  if length(v_url) > 500 or v_url !~* '^https://([a-z0-9-]+\.)+[a-z]{2,}(:[0-9]+)?(/[^[:space:]]*)?$' then
    raise exception 'invalid_url' using errcode = '22023';
  end if;
  v_host := lower(substring(v_url from '^https://([^/:?#]+)'));
  v_host := regexp_replace(v_host, '^www\.', '');

  if p_slot is not null then
    select s.id, s.name into v_slot, v_name from public.slots s where s.id = p_slot and s.is_active;
    if v_slot is null then
      raise exception 'invalid_slot' using errcode = '22023';
    end if;
  end if;
  if length(v_name) = 0 then
    raise exception 'invalid_slot' using errcode = '22023';
  end if;
  if (p_bet is not null and (p_bet <= 0 or p_bet > 999999999999))
     or (p_bonus_cost is not null and (p_bonus_cost <= 0 or p_bonus_cost > 999999999999))
     or (p_payout is not null and (p_payout < 0 or p_payout > 999999999999)) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_multi is not null and (p_multi <= 0 or p_multi > 9999999999) then
    raise exception 'invalid_multi' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 200 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  if exists (select 1 from public.replays r where r.url = v_url) then
    raise exception 'replay_duplicate' using errcode = '22023';
  end if;
  if (select count(*) from public.replays r where r.user_id = v_uid and r.status = 'pending') >= 5 then
    raise exception 'too_many_pending' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('replay', 5, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  insert into public.replays (user_id, url, host, slot_id, slot_name, note, currency, bet, bonus_cost, payout, multi)
  values (
    v_uid, v_url, v_host, v_slot, v_name, v_note, coalesce(p_currency, 'ARS'), p_bet, p_bonus_cost, p_payout,
    case when p_bet > 0 and p_payout is not null then round(p_payout / p_bet, 2) else p_multi end
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.submit_replay(text, uuid, text, text, public.currency_code, numeric, numeric, numeric, numeric)
  from public, anon;
grant execute on function public.submit_replay(text, uuid, text, text, public.currency_code, numeric, numeric, numeric, numeric)
  to authenticated;
