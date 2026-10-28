-- =============================================================================
-- Rate limiting en Postgres (ventana fija por usuario y acción).
-- =============================================================================

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);

alter table public.rate_limits enable row level security;
-- Sin policies: solo se toca desde la función de abajo.

-- Devuelve true si la acción está permitida y la cuenta. La clave se arma con
-- auth.uid() acá adentro para que nadie pueda consumir el cupo de otro.
create function public.hit_rate_limit(p_action text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_now timestamptz := now();
  v_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  v_key := p_action || ':' || auth.uid()::text;

  insert into public.rate_limits as r (key, window_start, count)
  values (v_key, v_now, 1)
  on conflict (key) do update
     set window_start = case
           when r.window_start <= v_now - make_interval(secs => p_window_seconds) then v_now
           else r.window_start
         end,
         count = case
           when r.window_start <= v_now - make_interval(secs => p_window_seconds) then 1
           else r.count + 1
         end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.hit_rate_limit(text, integer, integer) to authenticated;
