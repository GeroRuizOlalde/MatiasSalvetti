-- =============================================================================
-- Tipeos: un call de un slot que ya pagó más de 110x (en un hunt o en buys)
-- se marca como recomendación. Si el panel lo acepta como tipeo, queda en una
-- lista con el pago que lo hizo recomendable.
-- =============================================================================

-- Mejor pago histórico (ya abierto) de un slot, en hunts o en buys. Se busca por
-- slot del catálogo y, si no, por nombre (los slots cargados a mano no tienen id).
create function public.slot_best_hit(p_slot uuid, p_name text)
returns table (multi numeric, source text, source_id uuid, title text, hit_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select x.multi, x.source, x.source_id, x.title, x.hit_at
    from (
      select b.multi, 'hunt'::text as source, h.id as source_id, h.title, coalesce(b.opened_at, b.created_at) as hit_at
        from public.hunt_bonuses b
        join public.hunts h on h.id = b.hunt_id
       where b.multi is not null
         and ((p_slot is not null and b.slot_id = p_slot) or lower(trim(b.slot_name)) = lower(trim(p_name)))
      union all
      select y.multi, 'buy'::text, s.id, s.title, coalesce(y.opened_at, y.created_at)
        from public.buys y
        join public.buy_sessions s on s.id = y.session_id
       where y.multi is not null
         and ((p_slot is not null and y.slot_id = p_slot) or lower(trim(y.slot_name)) = lower(trim(p_name)))
    ) x
   order by x.multi desc, x.hit_at desc
   limit 1;
$$;

-- Umbral del tipeo, en un solo lugar.
create function public.tipeo_min_multi()
returns numeric
language sql
immutable
set search_path = ''
as $$ select 110::numeric $$;

-- -----------------------------------------------------------------------------
-- tipeos
-- -----------------------------------------------------------------------------
create table public.tipeos (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts (id) on delete cascade,
  call_id uuid unique references public.hunt_calls (id) on delete set null,
  bonus_id uuid references public.hunt_bonuses (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  slot_id uuid references public.slots (id) on delete set null,
  slot_name text not null,
  ref_multi numeric(14, 2) not null,
  ref_source text not null check (ref_source in ('hunt', 'buy')),
  ref_title text not null,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tipeos_created_idx on public.tipeos (created_at desc);

alter table public.tipeos enable row level security;

create policy "tipeos_select_panel" on public.tipeos
  for select using (public.is_mod());

revoke all on public.tipeos from anon;
revoke insert, update, delete on public.tipeos from authenticated;

-- Calls pendientes de un hunt que califican como tipeo, con el pago que los respalda.
create function public.hunt_tipeo_candidates(p_hunt uuid)
returns table (call_id uuid, multi numeric, source text, title text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select c.id, hit.multi, hit.source, hit.title
      from public.hunt_calls c
     cross join lateral public.slot_best_hit(c.slot_id, c.slot_name) hit
     where c.hunt_id = p_hunt
       and c.status = 'pending'
       and hit.multi > public.tipeo_min_multi();
end;
$$;

-- Acepta el call (lo convierte en bono, como siempre) y lo anota como tipeo.
create function public.accept_hunt_call_as_tipeo(p_call uuid, p_bet numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_call public.hunt_calls%rowtype;
  v_hit record;
  v_bonus uuid;
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_call from public.hunt_calls c where c.id = p_call for update;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;

  select * into v_hit from public.slot_best_hit(v_call.slot_id, v_call.slot_name);
  if v_hit.multi is null or v_hit.multi <= public.tipeo_min_multi() then
    raise exception 'not_tipeo' using errcode = '22023';
  end if;

  v_bonus := public.accept_hunt_call(p_call, p_bet);

  insert into public.tipeos (
    hunt_id, call_id, bonus_id, user_id, slot_id, slot_name, ref_multi, ref_source, ref_title, accepted_by
  )
  values (
    v_call.hunt_id, v_call.id, v_bonus, v_call.user_id, v_call.slot_id, v_call.slot_name,
    v_hit.multi, v_hit.source, v_hit.title, auth.uid()
  );
  return v_bonus;
end;
$$;

revoke execute on function public.slot_best_hit(uuid, text) from public, anon, authenticated;
revoke execute on function public.hunt_tipeo_candidates(uuid) from public, anon;
revoke execute on function public.accept_hunt_call_as_tipeo(uuid, numeric) from public, anon;
grant execute on function public.hunt_tipeo_candidates(uuid) to authenticated;
grant execute on function public.accept_hunt_call_as_tipeo(uuid, numeric) to authenticated;
