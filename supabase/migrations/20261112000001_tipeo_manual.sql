-- =============================================================================
-- Tipeo a mano: el panel le da un tipeo a cualquier usuario, sin que venga de un
-- bono o una compra, con una descripción que explica el motivo. La descripción
-- (`note`) también se puede guardar en los tipeos que salen de un bono.
-- =============================================================================

alter table public.tipeos
  add column note text check (note is null or length(trim(note)) between 1 and 300),
  alter column slot_name drop not null,
  alter column bet drop not null,
  alter column payout drop not null,
  alter column multi drop not null,
  drop constraint tipeos_one_source,
  -- Hunt, Bonus Buy o a mano (sin ninguno de los dos).
  add constraint tipeos_one_source check (num_nonnulls(bonus_id, buy_id) <= 1),
  add constraint tipeos_manual_note check (num_nonnulls(bonus_id, buy_id) = 1 or note is not null);

create function public.give_manual_tipeo(p_user uuid, p_note text, p_slot text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_slot text := nullif(left(trim(coalesce(p_slot, '')), 120), '');
  v_id uuid;
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user) then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if v_note is null or length(v_note) > 300 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  insert into public.tipeos (user_id, slot_name, note, status, decided_by)
  values (p_user, v_slot, v_note, 'given', auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Quitar un tipeo dado a mano (los de bonos se quitan con decide_tipeo / decide_buy_tipeo).
create function public.remove_manual_tipeo(p_tipeo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.tipeos t where t.id = p_tipeo and t.bonus_id is null and t.buy_id is null;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
end;
$$;

-- El aviso explica el motivo cuando es a mano (o cuando el panel dejó una descripción).
create or replace function public.notify_tipeo_given()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'given' and new.user_id is not null and (tg_op = 'INSERT' or old.status <> 'given') then
    perform public.notify('user', new.user_id, 'tipeo_given', '¡Te dieron tipeo!',
      coalesce(
        new.note,
        new.slot_name || ' pagó ' || public.format_multi(new.multi)
      ),
      case
        when new.hunt_id is not null then '/bonus-hunt/' || new.hunt_id
        when new.session_id is not null then '/bonus-buys/' || new.session_id
        else '/cuartel'
      end);
  end if;
  return null;
end;
$$;

revoke execute on function public.give_manual_tipeo(uuid, text, text) from public, anon;
revoke execute on function public.remove_manual_tipeo(uuid) from public, anon;
grant execute on function public.give_manual_tipeo(uuid, text, text) to authenticated;
grant execute on function public.remove_manual_tipeo(uuid) to authenticated;
