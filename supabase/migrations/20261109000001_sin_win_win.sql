-- Win Win sale de la web. Se desactiva en vez de borrarlo: no aparece en ningún lado
-- (casinos, verificaciones, sorteos), pero se conservan las cuentas ya verificadas
-- y cualquier carrera vieja que lo use. Se reactiva desde Panel → Catálogo → Casinos.
update public.casinos set is_active = false where slug = 'win-win';
