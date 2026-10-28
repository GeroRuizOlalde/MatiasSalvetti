-- =============================================================================
-- Tipeos por resultado: cuando se abre un bono que vino del call de un viewer y
-- paga más de 110x, el panel recomienda darle tipeo a ese viewer. El admin lo da
-- o lo descarta; los dados forman la lista de tipeos.
--
-- Reemplaza el modelo anterior (marcar el call si el slot ya había pagado antes).
-- Esa tabla nunca llegó a usarse, así que se borra y se arma de nuevo.
-- =============================================================================

drop function if exists public.accept_hunt_call_as_tipeo(uuid, numeric);
drop function if exists public.hunt_tipeo_candidates(uuid);
drop function if exists public.slot_best_hit(uuid, text);
drop table if exists public.tipeos;

create type public.tipeo_status as enum ('given', 'dismissed');

create table public.tipeos (
  id uuid primary key default gen_random_uuid(),
  bonus_id uuid not null unique references public.hunt_bonuses (id) on delete cascade,
  hunt_id uuid not null references public.hunts (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  slot_name text not null,
  bet numeric(14, 2) not null,
  payout numeric(14, 2) not null,
  multi numeric(14, 2) not null,
  status public.tipeo_status not null,
  decided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tipeos_status_created_idx on public.tipeos (status, created_at desc);
create index tipeos_hunt_idx on public.tipeos (hunt_id);

alter table public.tipeos enable row level security;

create policy "tipeos_select_panel" on public.tipeos
  for select using (public.is_mod());

revoke all on public.tipeos from anon;
revoke insert, update, delete on public.tipeos from authenticated;

-- Da (p_give = true) o descarta el tipeo de un bono. Se puede cambiar de idea:
-- descartar uno dado lo saca de la lista, y viceversa.
create function public.decide_tipeo(p_bonus uuid, p_give boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bonus public.hunt_bonuses%rowtype;
  v_id uuid;
begin
  if not public.is_mod() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_bonus from public.hunt_bonuses b where b.id = p_bonus for update;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if v_bonus.called_by is null then
    raise exception 'bonus_not_called' using errcode = '22023';
  end if;
  if v_bonus.multi is null or v_bonus.multi <= public.tipeo_min_multi() then
    raise exception 'not_tipeo' using errcode = '22023';
  end if;

  insert into public.tipeos (bonus_id, hunt_id, user_id, slot_name, bet, payout, multi, status, decided_by)
  values (
    v_bonus.id, v_bonus.hunt_id, v_bonus.called_by, v_bonus.slot_name, v_bonus.bet, v_bonus.payout, v_bonus.multi,
    case when p_give then 'given' else 'dismissed' end::public.tipeo_status, auth.uid()
  )
  on conflict (bonus_id) do update
    set status = excluded.status,
        decided_by = excluded.decided_by,
        bet = excluded.bet,
        payout = excluded.payout,
        multi = excluded.multi,
        created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.decide_tipeo(uuid, boolean) from public, anon;
grant execute on function public.decide_tipeo(uuid, boolean) to authenticated;

-- El tipeo se borra solo con el bono (on delete cascade): ya no hace falta en el trigger.
create or replace function public.hunt_bonuses_free_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.hunt_calls c where c.bonus_id = old.id;
  return old;
end;
$$;
