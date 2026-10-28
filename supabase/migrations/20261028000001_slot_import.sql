-- =============================================================================
-- Importación masiva de slots (CSV desde el panel). Corre con los permisos del
-- usuario (security invoker): la policy de insert de slots exige mod o admin.
-- Los duplicados (mismo nombre y proveedor, sin importar mayúsculas) se ignoran.
-- =============================================================================

create function public.import_slots(p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'invalid_rows' using errcode = '22023';
  end if;

  with input as (
    select distinct on (lower(name), lower(coalesce(provider, '')))
           name, provider
      from (
        select left(trim(r ->> 'name'), 120) as name,
               nullif(left(trim(coalesce(r ->> 'provider', '')), 80), '') as provider
          from jsonb_array_elements(p_rows) r
      ) raw
     where length(name) > 0
  ),
  inserted as (
    insert into public.slots (name, provider, created_by)
    select name, provider, auth.uid() from input
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

revoke execute on function public.import_slots(jsonb) from public, anon;
grant execute on function public.import_slots(jsonb) to authenticated;
