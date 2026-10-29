-- =============================================================================
-- Replays: los viewers comparten links de replays de slots (Nolimit City,
-- Pragmatic, etc.). El panel los aprueba antes de que se vean en la web.
--
-- Los proveedores se cargan desde el panel con su dominio. Si el proveedor deja
-- mostrar su replay dentro de otra web (`embeddable`), se ve en la página; si no,
-- se abre en otra pestaña. Un link de un dominio que no está en la lista se puede
-- mandar igual, pero el panel lo ve marcado como «proveedor desconocido».
-- =============================================================================

create table public.replay_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  -- Sin https:// ni barras: "nolimitcity.com". También vale para sus subdominios.
  domain text not null unique check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'),
  embeddable boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.replays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  url text not null unique check (length(url) <= 500),
  -- Dominio del link, para reconocer el proveedor.
  host text not null,
  slot_id uuid references public.slots (id) on delete set null,
  slot_name text not null check (length(trim(slot_name)) between 1 and 120),
  multi numeric(12,2) check (multi is null or multi > 0),
  note text check (note is null or length(trim(note)) between 1 and 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text check (reject_reason is null or length(reject_reason) <= 200),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index replays_status_idx on public.replays (status, created_at desc);
create index replays_user_idx on public.replays (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Mandar un replay
-- -----------------------------------------------------------------------------
create function public.submit_replay(
  p_url text,
  p_slot uuid default null,
  p_slot_name text default null,
  p_multi numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_url text := trim(coalesce(p_url, ''));
  v_host text;
  v_name text := left(trim(coalesce(p_slot_name, '')), 120);
  v_slot uuid := null;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_participate() then
    raise exception 'cannot_participate' using errcode = '42501';
  end if;

  -- Solo links https a un dominio, sin espacios.
  if length(v_url) > 500 or v_url !~* '^https://([a-z0-9-]+\.)+[a-z]{2,}(:[0-9]+)?(/[^[:space:]]*)?$' then
    raise exception 'invalid_url' using errcode = '22023';
  end if;
  v_host := lower(substring(v_url from '^https://([^/:?#]+)'));
  v_host := regexp_replace(v_host, '^www\.', '');

  if p_slot is not null then
    select s.id, s.name into v_slot, v_name from public.slots s where s.id = p_slot and s.is_active;
    if v_slot is null then
      raise exception 'invalid_slot' using errcode = '22023';
    end if;
  end if;
  if length(v_name) = 0 then
    raise exception 'invalid_slot' using errcode = '22023';
  end if;
  if p_multi is not null and (p_multi <= 0 or p_multi > 9999999999) then
    raise exception 'invalid_multi' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 200 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  if exists (select 1 from public.replays r where r.url = v_url) then
    raise exception 'replay_duplicate' using errcode = '22023';
  end if;
  if (select count(*) from public.replays r where r.user_id = v_uid and r.status = 'pending') >= 5 then
    raise exception 'too_many_pending' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('replay', 5, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  insert into public.replays (user_id, url, host, slot_id, slot_name, multi, note)
  values (v_uid, v_url, v_host, v_slot, v_name, p_multi, v_note)
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Revisar (panel). Se puede cambiar de idea: aprobar uno rechazado o al revés.
-- -----------------------------------------------------------------------------
create function public.review_replay(p_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.replays
     set status = case when p_approve then 'approved' else 'rejected' end,
         reject_reason = case when p_approve then null else nullif(left(trim(coalesce(p_reason, '')), 200), '') end,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Avisos
-- -----------------------------------------------------------------------------
create function public.notify_replay()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify('panel', null, 'replay_new', 'Nuevo replay',
      public.viewer_name(new.user_id) || ' compartió un replay de ' || new.slot_name,
      '/panel/replays');
  elsif old.status <> new.status and new.status = 'approved' then
    perform public.notify('user', new.user_id, 'replay_approved', 'Tu replay está publicado',
      new.slot_name || ' ya se ve en Replays.', '/replays');
  elsif old.status <> new.status and new.status = 'rejected' then
    perform public.notify('user', new.user_id, 'replay_rejected', 'Tu replay no se publicó',
      coalesce(new.reject_reason, new.slot_name || ' no se publicó.'), '/replays');
  end if;
  return null;
end;
$$;

create trigger replays_notify
  after insert or update of status on public.replays
  for each row execute function public.notify_replay();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.replay_providers enable row level security;
alter table public.replays enable row level security;

create policy "replay_providers_select" on public.replay_providers
  for select to anon, authenticated
  using (true);

create policy "replay_providers_mod_write" on public.replay_providers
  for all to authenticated
  using (public.is_mod())
  with check (public.is_mod());

-- Los aprobados los ve todo el mundo; cada uno ve los suyos; el panel ve todos.
create policy "replays_select" on public.replays
  for select to anon, authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_mod());

-- El viewer puede borrar el suyo mientras no se revisó; el panel, cualquiera.
create policy "replays_delete" on public.replays
  for delete to authenticated
  using ((user_id = auth.uid() and status = 'pending') or public.is_mod());

revoke insert, update, delete on public.replay_providers from anon;
revoke insert, update on public.replays from anon, authenticated;
revoke delete on public.replays from anon;

revoke execute on function public.notify_replay() from public, anon, authenticated;
revoke execute on function public.submit_replay(text, uuid, text, numeric, text) from public, anon;
revoke execute on function public.review_replay(uuid, boolean, text) from public, anon;
grant execute on function public.submit_replay(text, uuid, text, numeric, text) to authenticated;
grant execute on function public.review_replay(uuid, boolean, text) to authenticated;

-- Proveedores de entrada. Si alguno se ve bien dentro de la web, se activa desde el panel.
insert into public.replay_providers (name, domain) values
  ('Nolimit City', 'nolimitcity.com'),
  ('Pragmatic Play', 'ppreplaylink.net');
