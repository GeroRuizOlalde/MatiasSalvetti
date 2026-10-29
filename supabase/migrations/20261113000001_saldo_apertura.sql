-- =============================================================================
-- Saldo de apertura del Bonus Hunt: con cuánta plata se empieza a abrir los
-- bonos (lo que quedó en la cuenta después de comprarlos/juntarlos).
-- Balance final = saldo de apertura + lo que pagaron los bonos.
-- Ganancia = balance final - inversión inicial.
-- =============================================================================

alter table public.hunts
  add column opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0);

create or replace function public.hunts_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_finished boolean := tg_op = 'UPDATE' and old.status = 'finished';
begin
  if new.status <> 'finished' then
    new.final_balance := null;
    new.gtb_winner_id := null;
    new.finished_at := null;
  elsif v_was_finished then
    -- Un hunt cerrado no cambia sus resultados a mano.
    new.final_balance := old.final_balance;
    new.gtb_winner_id := old.gtb_winner_id;
    new.finished_at := old.finished_at;
  else
    if not exists (select 1 from public.hunt_bonuses b where b.hunt_id = new.id) then
      raise exception 'hunt_without_bonuses' using errcode = '22023';
    end if;
    if exists (select 1 from public.hunt_bonuses b where b.hunt_id = new.id and b.payout is null) then
      raise exception 'bonuses_pending' using errcode = '22023';
    end if;

    new.calls_open := false;
    new.guesses_open := false;
    new.finished_at := now();
    select new.opening_balance + coalesce(sum(b.payout), 0) into new.final_balance
      from public.hunt_bonuses b where b.hunt_id = new.id;
    select g.user_id into new.gtb_winner_id
      from public.hunt_guesses g
      join public.profiles p on p.id = g.user_id and p.banned_at is null
     where g.hunt_id = new.id
     order by abs(g.amount - new.final_balance), g.updated_at, g.id
     limit 1;
  end if;
  return new;
end;
$$;
