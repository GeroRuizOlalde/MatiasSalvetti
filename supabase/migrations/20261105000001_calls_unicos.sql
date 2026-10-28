-- =============================================================================
-- Calls: una máquina por hunt y sin cambios.
-- - El call no se puede cambiar una vez mandado. Si el panel lo rechaza, el
--   viewer puede pedir otro.
-- - Un slot que ya pidió otro viewer (call pendiente o aceptado) o que ya está
--   como bono en el hunt no se puede pedir.
-- =============================================================================

create or replace function public.submit_hunt_call(p_hunt uuid, p_slot uuid default null, p_slot_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := left(trim(coalesce(p_slot_name, '')), 120);
  v_slot uuid := null;
  v_existing public.hunt_calls%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.hunts h where h.id = p_hunt and h.calls_open and h.status in ('collecting', 'opening')
  ) then
    raise exception 'calls_closed' using errcode = '22023';
  end if;

  if p_slot is not null then
    select s.id, s.name into v_slot, v_name from public.slots s where s.id = p_slot and s.is_active;
    if v_slot is null then
      raise exception 'invalid_slot' using errcode = '22023';
    end if;
  end if;
  if length(v_name) = 0 then
    raise exception 'invalid_slot' using errcode = '22023';
  end if;

  -- Dos viewers pidiendo la misma máquina a la vez: el segundo espera y ve el primero.
  perform pg_advisory_xact_lock(hashtext('hunt_call:' || p_hunt::text));

  select * into v_existing from public.hunt_calls c where c.hunt_id = p_hunt and c.user_id = v_uid for update;
  if v_existing.status = 'accepted' then
    raise exception 'call_already_accepted' using errcode = '22023';
  end if;
  if v_existing.status = 'pending' then
    raise exception 'call_already_sent' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.hunt_calls c
     where c.hunt_id = p_hunt
       and c.status in ('pending', 'accepted')
       and ((v_slot is not null and c.slot_id = v_slot) or lower(trim(c.slot_name)) = lower(v_name))
  ) or exists (
    select 1 from public.hunt_bonuses b
     where b.hunt_id = p_hunt
       and ((v_slot is not null and b.slot_id = v_slot) or lower(trim(b.slot_name)) = lower(v_name))
  ) then
    raise exception 'slot_taken' using errcode = '22023';
  end if;

  if not public.hit_rate_limit('hunt_call', 6, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  if v_existing.id is not null then
    -- Solo llega acá si estaba rechazado: vuelve a la fila como un call nuevo.
    update public.hunt_calls
       set slot_id = v_slot, slot_name = v_name, status = 'pending', reviewed_by = null, reviewed_at = null,
           created_at = now()
     where id = v_existing.id
    returning id into v_id;
  else
    insert into public.hunt_calls (hunt_id, user_id, slot_id, slot_name)
    values (p_hunt, v_uid, v_slot, v_name)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Máquinas que ya no se pueden pedir en un hunt (sin decir quién las pidió).
create function public.hunt_taken_slots(p_hunt uuid)
returns table (slot_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (lower(trim(x.slot_name))) x.slot_name
    from (
      select c.slot_name from public.hunt_calls c
       where c.hunt_id = p_hunt and c.status in ('pending', 'accepted')
      union all
      select b.slot_name from public.hunt_bonuses b where b.hunt_id = p_hunt
    ) x
   where exists (select 1 from public.hunts h where h.id = p_hunt and h.status <> 'draft')
   order by lower(trim(x.slot_name)), x.slot_name;
$$;

revoke execute on function public.hunt_taken_slots(uuid) from public;
grant execute on function public.hunt_taken_slots(uuid) to anon, authenticated;
