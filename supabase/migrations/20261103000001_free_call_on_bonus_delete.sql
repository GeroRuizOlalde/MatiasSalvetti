-- =============================================================================
-- Borrar un bono que vino de un call libera al viewer para volver a pedir.
-- Antes el call quedaba «aceptado» sin bono y submit_hunt_call lo rechazaba.
-- =============================================================================

-- BEFORE: la FK hunt_calls.bonus_id (on delete set null) corre después y ya no
-- dejaría encontrar el call.
create function public.hunt_bonuses_free_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tipeos t where t.bonus_id = old.id;
  delete from public.hunt_calls c where c.bonus_id = old.id;
  return old;
end;
$$;

create trigger hunt_bonuses_free_call
  before delete on public.hunt_bonuses
  for each row execute function public.hunt_bonuses_free_call();

revoke execute on function public.hunt_bonuses_free_call() from public, anon, authenticated;

-- Destraba a los viewers que ya quedaron así: un call aceptado siempre tiene
-- bono, así que uno sin bono es porque el bono se borró.
delete from public.tipeos t
 where t.bonus_id is null
   and exists (select 1 from public.hunt_calls c where c.id = t.call_id and c.status = 'accepted' and c.bonus_id is null);
delete from public.hunt_calls where status = 'accepted' and bonus_id is null;
