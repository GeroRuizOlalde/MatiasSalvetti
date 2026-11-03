-- =============================================================================
-- Slots sugeridos: cuando un viewer callea un slot que no está en el catálogo
-- (lo escribe a mano), queda como sugerencia para que el panel lo agregue con
-- su proveedor. Si lo escribió igual que uno del catálogo, se vincula solo.
-- =============================================================================

create table public.slot_suggestions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  provider text check (provider is null or length(trim(provider)) between 1 and 80),
  -- Nombre normalizado: una sola sugerencia por slot.
  name_key text not null unique,
  -- Cuántas veces lo pidieron y de dónde vino el primer pedido.
  times integer not null default 1,
  source text not null check (source in ('hunt', 'buy', 'battle')),
  suggested_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'added', 'dismissed')),
  slot_id uuid references public.slots (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index slot_suggestions_status_idx on public.slot_suggestions (status, updated_at desc);

create trigger slot_suggestions_touch_updated_at
  before update on public.slot_suggestions
  for each row execute function public.touch_updated_at();

create function public.slot_name_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- Calls: vincular al catálogo o dejar la sugerencia
-- -----------------------------------------------------------------------------
create function public.calls_link_or_suggest_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := public.slot_name_key(new.slot_name);
  v_slot uuid;
  v_matches integer;
  v_source text := case tg_table_name when 'hunt_calls' then 'hunt' when 'buy_calls' then 'buy' else 'battle' end;
begin
  if new.slot_id is not null or v_key = '' then
    return new;
  end if;

  select count(*), min(s.id::text)::uuid into v_matches, v_slot
    from public.slots s
   where s.is_active and public.slot_name_key(s.name) = v_key;
  -- Escrito igual que un slot del catálogo: se vincula.
  if v_matches = 1 then
    new.slot_id := v_slot;
    return new;
  end if;
  -- Hay varios con ese nombre (distinto proveedor): no se adivina, el panel elige al aceptar.
  if v_matches > 1 then
    return new;
  end if;

  insert into public.slot_suggestions (name, name_key, source, suggested_by)
  values (trim(new.slot_name), v_key, v_source, new.user_id)
  on conflict (name_key) do update
    set times = public.slot_suggestions.times + 1
  -- Las descartadas o ya agregadas no vuelven.
  where public.slot_suggestions.status = 'pending';
  return new;
end;
$$;

create trigger hunt_calls_link_or_suggest_slot
  before insert on public.hunt_calls
  for each row execute function public.calls_link_or_suggest_slot();

create trigger buy_calls_link_or_suggest_slot
  before insert on public.buy_calls
  for each row execute function public.calls_link_or_suggest_slot();

create trigger battle_calls_link_or_suggest_slot
  before insert on public.battle_calls
  for each row execute function public.calls_link_or_suggest_slot();

-- -----------------------------------------------------------------------------
-- Panel: agregar al catálogo (con nombre y proveedor corregidos) o descartar
-- -----------------------------------------------------------------------------
create function public.add_slot_suggestion(p_id uuid, p_name text, p_provider text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suggestion public.slot_suggestions%rowtype;
  v_name text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 120);
  v_provider text := nullif(left(trim(coalesce(p_provider, '')), 80), '');
  v_slot uuid;
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_suggestion from public.slot_suggestions s where s.id = p_id for update;
  if v_suggestion.id is null or v_suggestion.status <> 'pending' then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if length(v_name) = 0 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  -- Si ya existe con ese nombre y proveedor, se usa ese.
  select s.id into v_slot
    from public.slots s
   where lower(s.name) = lower(v_name) and lower(coalesce(s.provider, '')) = lower(coalesce(v_provider, ''));
  if v_slot is null then
    insert into public.slots (name, provider, created_by) values (v_name, v_provider, auth.uid())
    returning id into v_slot;
  end if;

  update public.slot_suggestions
     set name = v_name, provider = v_provider, status = 'added', slot_id = v_slot,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;

  -- Todo lo que se pidió o cargó con ese nombre queda vinculado al slot.
  update public.hunt_calls set slot_id = v_slot
   where slot_id is null and public.slot_name_key(slot_name) = v_suggestion.name_key;
  update public.buy_calls set slot_id = v_slot
   where slot_id is null and public.slot_name_key(slot_name) = v_suggestion.name_key;
  update public.battle_calls set slot_id = v_slot
   where slot_id is null and public.slot_name_key(slot_name) = v_suggestion.name_key;
  update public.hunt_bonuses set slot_id = v_slot
   where slot_id is null and public.slot_name_key(slot_name) = v_suggestion.name_key;
  update public.buys set slot_id = v_slot
   where slot_id is null and public.slot_name_key(slot_name) = v_suggestion.name_key;
  update public.battle_entries set slot_id = v_slot
   where slot_id is null and public.slot_name_key(slot_name) = v_suggestion.name_key;

  return v_slot;
end;
$$;

create function public.dismiss_slot_suggestion(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.slot_suggestions
     set status = 'dismissed', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id and status = 'pending';
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS: solo el panel ve y edita las sugerencias
-- -----------------------------------------------------------------------------
alter table public.slot_suggestions enable row level security;

create policy "slot_suggestions_mod_select" on public.slot_suggestions
  for select to authenticated
  using (public.is_mod());

-- El panel puede corregir nombre y proveedor antes de agregarlo.
create policy "slot_suggestions_mod_update" on public.slot_suggestions
  for update to authenticated
  using (public.is_mod() and status = 'pending')
  with check (public.is_mod());

revoke all on public.slot_suggestions from anon;
revoke insert, delete on public.slot_suggestions from authenticated;

revoke execute on function public.calls_link_or_suggest_slot() from public, anon, authenticated;
revoke execute on function public.add_slot_suggestion(uuid, text, text) from public, anon;
revoke execute on function public.dismiss_slot_suggestion(uuid) from public, anon;
grant execute on function public.add_slot_suggestion(uuid, text, text) to authenticated;
grant execute on function public.dismiss_slot_suggestion(uuid) to authenticated;

-- Los calls que ya se hicieron con slots que no están en el catálogo también quedan sugeridos.
insert into public.slot_suggestions (name, name_key, source, suggested_by, times, created_at)
select distinct on (c.name_key) c.slot_name, c.name_key, c.source, c.user_id, c.times, c.created_at
  from (
    select public.slot_name_key(slot_name) as name_key, trim(slot_name) as slot_name, user_id, created_at,
           'hunt' as source, count(*) over (partition by public.slot_name_key(slot_name)) as times
      from public.hunt_calls where slot_id is null
    union all
    select public.slot_name_key(slot_name), trim(slot_name), user_id, created_at,
           'buy', count(*) over (partition by public.slot_name_key(slot_name))
      from public.buy_calls where slot_id is null
    union all
    select public.slot_name_key(slot_name), trim(slot_name), user_id, created_at,
           'battle', count(*) over (partition by public.slot_name_key(slot_name))
      from public.battle_calls where slot_id is null
  ) c
 where c.name_key <> ''
   and not exists (select 1 from public.slots s where public.slot_name_key(s.name) = c.name_key)
 order by c.name_key, c.created_at
on conflict (name_key) do nothing;
