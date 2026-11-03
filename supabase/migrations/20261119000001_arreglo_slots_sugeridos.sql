-- =============================================================================
-- Arreglo de «Agregar al catálogo» en slots sugeridos: fallaba si el slot ya
-- estaba cargado como bono en un hunt terminado (o en una sesión de buys o una
-- battle cerradas), porque esos registros no se pueden modificar. Ahora solo se
-- vinculan los de sesiones abiertas; los cerrados se ven igual (guardan el nombre).
-- =============================================================================

create or replace function public.add_slot_suggestion(p_id uuid, p_name text, p_provider text default null)
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
  -- Los bonos, compras y slots de battles que ya cerraron no se pueden tocar (y se ven igual
  -- porque guardan el nombre): solo se vinculan los de sesiones abiertas.
  update public.hunt_bonuses b set slot_id = v_slot
   where b.slot_id is null and public.slot_name_key(b.slot_name) = v_suggestion.name_key
     and exists (select 1 from public.hunts h where h.id = b.hunt_id and h.status <> 'finished');
  update public.buys b set slot_id = v_slot
   where b.slot_id is null and public.slot_name_key(b.slot_name) = v_suggestion.name_key
     and exists (select 1 from public.buy_sessions s where s.id = b.session_id and s.status <> 'finished');
  update public.battle_entries e set slot_id = v_slot
   where e.slot_id is null and public.slot_name_key(e.slot_name) = v_suggestion.name_key
     and exists (select 1 from public.battles t where t.id = e.battle_id and t.status not in ('live', 'finished'));

  return v_slot;
end;
$$;
