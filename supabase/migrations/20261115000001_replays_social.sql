-- =============================================================================
-- Replays como red social: cada replay es una publicación con montos (apuesta,
-- valor del bono y pago), me gusta y comentarios.
-- =============================================================================

alter table public.replays
  add column currency public.currency_code not null default 'ARS',
  -- Apuesta por giro.
  add column bet numeric(14,2) check (bet is null or bet > 0),
  -- Lo que costó el bono, si se compró.
  add column bonus_cost numeric(14,2) check (bonus_cost is null or bonus_cost > 0),
  add column payout numeric(14,2) check (payout is null or payout >= 0),
  -- Contadores que mantienen los triggers, para no contar en cada carga.
  add column likes_count integer not null default 0,
  add column comments_count integer not null default 0;

create table public.replay_likes (
  replay_id uuid not null references public.replays (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (replay_id, user_id)
);

create index replay_likes_user_idx on public.replay_likes (user_id);

create table public.replay_comments (
  id uuid primary key default gen_random_uuid(),
  replay_id uuid not null references public.replays (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);

create index replay_comments_replay_idx on public.replay_comments (replay_id, created_at);

-- -----------------------------------------------------------------------------
-- Mandar un replay (ahora con montos). El multi sale de pago / apuesta.
-- -----------------------------------------------------------------------------
drop function public.submit_replay(text, uuid, text, numeric, text);

create function public.submit_replay(
  p_url text,
  p_slot uuid default null,
  p_slot_name text default null,
  p_note text default null,
  p_currency public.currency_code default 'ARS',
  p_bet numeric default null,
  p_bonus_cost numeric default null,
  p_payout numeric default null
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
    case when p_bet > 0 and p_payout is not null then round(p_payout / p_bet, 2) end
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Me gusta: un toque pone, otro saca. Devuelve si quedó con me gusta.
-- -----------------------------------------------------------------------------
create function public.toggle_replay_like(p_replay uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  if not exists (select 1 from public.replays r where r.id = p_replay and r.status = 'approved') then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('replay_like', 30, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  delete from public.replay_likes l where l.replay_id = p_replay and l.user_id = v_uid;
  if found then
    return false;
  end if;
  insert into public.replay_likes (replay_id, user_id) values (p_replay, v_uid);
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Comentarios
-- -----------------------------------------------------------------------------
create function public.add_replay_comment(p_replay uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  if length(v_body) = 0 or length(v_body) > 300 then
    raise exception 'invalid_comment' using errcode = '22023';
  end if;
  if not exists (select 1 from public.replays r where r.id = p_replay and r.status = 'approved') then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('replay_comment', 5, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  insert into public.replay_comments (replay_id, user_id, body) values (p_replay, v_uid, v_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Contadores y avisos
-- -----------------------------------------------------------------------------
create function public.replay_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay uuid := coalesce(new.replay_id, old.replay_id);
  v_delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if tg_table_name = 'replay_likes' then
    update public.replays set likes_count = greatest(likes_count + v_delta, 0) where id = v_replay;
  else
    update public.replays set comments_count = greatest(comments_count + v_delta, 0) where id = v_replay;
  end if;
  return null;
end;
$$;

create trigger replay_likes_count
  after insert or delete on public.replay_likes
  for each row execute function public.replay_counts();

create trigger replay_comments_count
  after insert or delete on public.replay_comments
  for each row execute function public.replay_counts();

-- Al dueño del replay le avisa cada comentario de otro.
create function public.notify_replay_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay public.replays%rowtype;
begin
  select * into v_replay from public.replays r where r.id = new.replay_id;
  if v_replay.user_id is not null and v_replay.user_id <> new.user_id then
    perform public.notify('user', v_replay.user_id, 'replay_comment',
      public.viewer_name(new.user_id) || ' comentó tu replay',
      left(new.body, 140), '/replays#replay-' || new.replay_id);
  end if;
  return null;
end;
$$;

create trigger replay_comments_notify
  after insert on public.replay_comments
  for each row execute function public.notify_replay_comment();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.replay_likes enable row level security;
alter table public.replay_comments enable row level security;

create policy "replay_likes_select" on public.replay_likes
  for select to anon, authenticated
  using (true);

-- Los comentarios de replays publicados los ve cualquiera; el panel, todos.
create policy "replay_comments_select" on public.replay_comments
  for select to anon, authenticated
  using (
    public.is_mod()
    or exists (select 1 from public.replays r where r.id = replay_id and r.status = 'approved')
  );

-- Cada uno borra sus comentarios; el panel, cualquiera.
create policy "replay_comments_delete" on public.replay_comments
  for delete to authenticated
  using (user_id = auth.uid() or public.is_mod());

revoke insert, update, delete on public.replay_likes from anon, authenticated;
revoke insert, update on public.replay_comments from anon, authenticated;
revoke delete on public.replay_comments from anon;

revoke execute on function public.replay_counts() from public, anon, authenticated;
revoke execute on function public.notify_replay_comment() from public, anon, authenticated;
revoke execute on function public.submit_replay(text, uuid, text, text, public.currency_code, numeric, numeric, numeric)
  from public, anon;
revoke execute on function public.toggle_replay_like(uuid) from public, anon;
revoke execute on function public.add_replay_comment(uuid, text) from public, anon;
grant execute on function public.submit_replay(text, uuid, text, text, public.currency_code, numeric, numeric, numeric)
  to authenticated;
grant execute on function public.toggle_replay_like(uuid) to authenticated;
grant execute on function public.add_replay_comment(uuid, text) to authenticated;
