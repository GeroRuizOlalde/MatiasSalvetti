-- =============================================================================
-- Buscador de slots por palabras: "bonanza sweet" o "sweet 1000" encuentran
-- "Sweet Bonanza 1000". Cada palabra tiene que estar en el nombre o en el
-- proveedor, en cualquier orden. Si ningún slot las tiene todas (un error de
-- tipeo), se buscan los de nombre parecido.
-- Orden: exacto, empieza igual, todas las palabras en el nombre, parecido, más corto.
-- =============================================================================

create or replace function public.search_slots(p_query text, p_limit integer default 10)
returns setof public.slots
language sql
stable
set search_path = ''
as $$
  with q as (
    select t.text,
           -- Escapados para LIKE (\, % y _ se buscan literal).
           regexp_replace(t.text, '([\\%_])', '\\\1', 'g') as pattern,
           array(
             select regexp_replace(w, '([\\%_])', '\\\1', 'g')
               from regexp_split_to_table(t.text, '\s+') w
              where length(w) > 0
           ) as words
      from (select lower(trim(coalesce(p_query, ''))) as text) t
  ),
  matches as (
    select s.*
      from public.slots s
     cross join q
     where s.is_active
       and cardinality(q.words) > 0
       and (select bool_and(lower(s.name || ' ' || coalesce(s.provider, '')) like '%' || w || '%') from unnest(q.words) w)
  )
  select s.*
    from public.slots s
   cross join q
   where s.is_active
     and cardinality(q.words) > 0
     and (
       s.id in (select m.id from matches m)
       or (not exists (select 1 from matches) and lower(s.name) operator(extensions.%) q.text)
     )
   order by lower(s.name) = q.text desc,
            lower(s.name) like q.pattern || '%' desc,
            (select bool_and(lower(s.name) like '%' || w || '%') from unnest(q.words) w) desc,
            extensions.similarity(lower(s.name), q.text) desc,
            length(s.name),
            s.name
   limit least(greatest(coalesce(p_limit, 10), 1), 25);
$$;
