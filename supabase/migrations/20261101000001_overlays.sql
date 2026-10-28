-- =============================================================================
-- Overlays de OBS: validan el token (?key=…) sin exponerlo.
-- =============================================================================

create function public.check_overlay_token(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    length(coalesce(p_key, '')) >= 16
    and exists (select 1 from public.site_settings s where s.key = 'overlay_token' and s.value #>> '{}' = p_key),
    false
  );
$$;

revoke execute on function public.check_overlay_token(text) from public;
grant execute on function public.check_overlay_token(text) to anon, authenticated;
