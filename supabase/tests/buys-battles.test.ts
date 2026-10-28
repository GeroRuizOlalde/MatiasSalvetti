import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let mod: { id: string };
let viewerA: { id: string };
let viewerB: { id: string };
let newbie: { id: string };

const asMod = <T>(fn: () => Promise<T>) => as(db, mod, fn);

async function createSession(status = "live") {
  const { rows } = await asMod(() =>
    db.query<{ id: string }>("insert into public.buy_sessions (title, status) values ('Buys', $1) returning id", [
      status,
    ]),
  );
  return rows[0].id;
}

async function openPoll(session: string, names: string[]) {
  const options = names.map((slot_name) => ({ slot_name }));
  await asMod(() => db.query("select public.open_buy_poll($1, $2)", [session, JSON.stringify(options)]));
  const { rows } = await db.query<{ id: string; poll_id: string; slot_name: string }>(
    `select o.id, o.poll_id, o.slot_name from public.buy_poll_options o
       join public.buy_polls p on p.id = o.poll_id
      where p.session_id = $1 and p.is_open order by o.position`,
    [session],
  );
  return rows;
}

async function createBattle(slots: number, status = "open") {
  const { rows } = await asMod(() =>
    db.query<{ id: string }>("insert into public.battles (title, status) values ('Battle', $1) returning id", [status]),
  );
  const battle = rows[0].id;
  for (let i = 1; i <= slots; i++) {
    await asMod(() =>
      db.query("insert into public.battle_entries (battle_id, slot_name) values ($1, $2)", [battle, `Slot ${i}`]),
    );
  }
  const { rows: entries } = await db.query<{ id: string; seed: number }>(
    "select id, seed from public.battle_entries where battle_id = $1 order by seed",
    [battle],
  );
  return { battle, entries };
}

async function matches(battle: string) {
  const { rows } = await db.query<{
    id: string;
    round: number;
    slot: number;
    entry_a: string | null;
    entry_b: string | null;
    winner_entry_id: string | null;
  }>(
    "select id, round, slot, entry_a, entry_b, winner_entry_id from public.battle_matches where battle_id = $1 order by round, slot",
    [battle],
  );
  return rows;
}

async function setResult(matchId: string, betA: number, payoutA: number, betB: number, payoutB: number) {
  await asMod(() =>
    db.query("update public.battle_matches set bet_a = $2, payout_a = $3, bet_b = $4, payout_b = $5 where id = $1", [
      matchId,
      betA,
      payoutA,
      betB,
      payoutB,
    ]),
  );
}

beforeAll(async () => {
  db = await createTestDb();
  mod = await createTwitchUser(db, "mod_buys");
  viewerA = await createTwitchUser(db, "viewer_buys_a");
  viewerB = await createTwitchUser(db, "viewer_buys_b");
  newbie = await createTwitchUser(db, "viewer_buys_nuevo");
  await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
  for (const user of [viewerA, viewerB]) {
    await as(db, user, () => db.query("select public.accept_terms(1)"));
  }
}, 60_000);

describe("bonus buys", () => {
  it("numera las compras, calcula el multi y bloquea sesiones terminadas", async () => {
    const session = await createSession();
    const { rows } = await asMod(() =>
      db.query<{ position: number; multi: string }>(
        "insert into public.buys (session_id, slot_name, bet, cost, payout) values ($1, 'A', 100, 10000, 25000), ($1, 'B', 100, 10000, null) returning position, multi",
        [session],
      ),
    );
    expect(rows.map((r) => r.position)).toEqual([1, 2]);
    expect(rows[0].multi).toBe("250.00");

    await asMod(() => db.query("update public.buy_sessions set status = 'finished' where id = $1", [session]));
    await expect(
      asMod(() =>
        db.query("insert into public.buys (session_id, slot_name, bet, cost) values ($1, 'C', 1, 1)", [session]),
      ),
    ).rejects.toThrow(/session_finished/);
  });

  it("los borradores no se ven", async () => {
    const draft = await createSession("draft");
    const { rows } = await as(db, "anon", () => db.query("select id from public.buy_sessions where id = $1", [draft]));
    expect(rows).toHaveLength(0);
  });

  it("votación: un voto por viewer, editable, y gana la más votada", async () => {
    const session = await createSession();
    const options = await openPoll(session, ["Sugar Rush", "Wanted", "Gates"]);

    await expect(as(db, newbie, () => db.query("select public.cast_buy_vote($1)", [options[0].id]))).rejects.toThrow(
      /cannot_participate/,
    );

    await as(db, viewerA, () => db.query("select public.cast_buy_vote($1)", [options[0].id]));
    await as(db, viewerA, () => db.query("select public.cast_buy_vote($1)", [options[1].id]));
    await as(db, viewerB, () => db.query("select public.cast_buy_vote($1)", [options[1].id]));

    const counts = await as(db, "anon", () =>
      db.query<{ option_id: string; votes: number }>("select * from public.buy_poll_counts($1)", [session]),
    );
    const byOption = Object.fromEntries(counts.rows.map((r) => [r.option_id, r.votes]));
    expect(byOption[options[0].id]).toBe(0);
    expect(byOption[options[1].id]).toBe(2);

    await expect(as(db, viewerA, () => db.query("select public.close_buy_poll($1)", [session]))).rejects.toThrow(
      /forbidden/,
    );
    await asMod(() => db.query("select public.close_buy_poll($1)", [session]));

    const { rows } = await db.query<{ winner_option_id: string; is_open: boolean }>(
      "select winner_option_id, is_open from public.buy_polls where id = $1",
      [options[0].poll_id],
    );
    expect(rows[0]).toEqual({ winner_option_id: options[1].id, is_open: false });

    await expect(as(db, viewerB, () => db.query("select public.cast_buy_vote($1)", [options[0].id]))).rejects.toThrow(
      /poll_closed/,
    );
  });

  it("abrir una votación nueva cierra la anterior, y terminar la sesión cierra la abierta", async () => {
    const session = await createSession();
    const first = await openPoll(session, ["A", "B"]);
    await openPoll(session, ["C", "D"]);
    const { rows } = await db.query<{ is_open: boolean }>("select is_open from public.buy_polls where id = $1", [
      first[0].poll_id,
    ]);
    expect(rows[0].is_open).toBe(false);

    await asMod(() => db.query("update public.buy_sessions set status = 'finished' where id = $1", [session]));
    const { rows: open } = await db.query("select id from public.buy_polls where session_id = $1 and is_open", [
      session,
    ]);
    expect(open).toHaveLength(0);
  });

  it("pide entre 2 y 8 opciones", async () => {
    const session = await createSession();
    await expect(openPoll(session, ["Solo una"])).rejects.toThrow(/invalid_options/);
  });
});

describe("bonus battle", () => {
  it("solo arranca con 2, 4, 8 o 16 slots", async () => {
    const { battle } = await createBattle(3);
    await expect(asMod(() => db.query("select public.start_battle($1)", [battle]))).rejects.toThrow(
      /invalid_entry_count/,
    );
  });

  it("arma el cuadro, avanza ganadores y define al campeón", async () => {
    const { battle, entries } = await createBattle(4);
    const [e1, e2, e3, e4] = entries.map((e) => e.id);

    await as(db, viewerA, () => db.query("select public.pick_battle_entry($1)", [e3]));
    await as(db, viewerB, () => db.query("select public.pick_battle_entry($1)", [e1]));
    await as(db, viewerB, () => db.query("select public.pick_battle_entry($1)", [e2]));

    const hiddenPicks = await as(db, "anon", () =>
      db.query("select user_id from public.battle_picks where battle_id = $1", [battle]),
    );
    expect(hiddenPicks.rows).toHaveLength(0);

    await asMod(() => db.query("select public.start_battle($1)", [battle]));
    await expect(as(db, viewerA, () => db.query("select public.pick_battle_entry($1)", [e4]))).rejects.toThrow(
      /picks_closed/,
    );
    await expect(asMod(() => db.query("delete from public.battle_entries where id = $1", [e4]))).rejects.toThrow(
      /battle_started/,
    );

    let ms = await matches(battle);
    expect(ms.map((m) => [m.round, m.slot, m.entry_a, m.entry_b])).toEqual([
      [1, 0, e1, e2],
      [1, 1, e3, e4],
      [2, 0, null, null],
    ]);

    // e2 gana por multi aunque pague menos (bet más chica).
    await setResult(ms[0].id, 100, 5000, 10, 1000);
    // Empate de multi y pago: gana el mejor seed (e3).
    await setResult(ms[1].id, 100, 2000, 100, 2000);
    ms = await matches(battle);
    expect([ms[0].winner_entry_id, ms[1].winner_entry_id]).toEqual([e2, e3]);
    expect([ms[2].entry_a, ms[2].entry_b]).toEqual([e2, e3]);

    await setResult(ms[2].id, 100, 100, 100, 30000);
    const { rows } = await db.query<{ status: string; winner_entry_id: string }>(
      "select status, winner_entry_id from public.battles where id = $1",
      [battle],
    );
    expect(rows[0]).toEqual({ status: "finished", winner_entry_id: e3 });

    const picks = await as(db, "anon", () =>
      db.query<{ user_id: string }>("select user_id from public.battle_picks where battle_id = $1 and entry_id = $2", [
        battle,
        e3,
      ]),
    );
    expect(picks.rows.map((p) => p.user_id)).toEqual([viewerA.id]);
  });

  it("no deja cambiar un cruce si el siguiente ya empezó, y corregir la final reabre la battle", async () => {
    const { battle } = await createBattle(2);
    await asMod(() => db.query("select public.start_battle($1)", [battle]));
    const [final] = await matches(battle);
    await setResult(final.id, 1, 10, 1, 5);
    await asMod(() => db.query("update public.battle_matches set payout_a = null where id = $1", [final.id]));
    const { rows } = await db.query<{ status: string; winner_entry_id: string | null }>(
      "select status, winner_entry_id from public.battles where id = $1",
      [battle],
    );
    expect(rows[0]).toEqual({ status: "live", winner_entry_id: null });

    const four = await createBattle(4);
    await asMod(() => db.query("select public.start_battle($1)", [four.battle]));
    const ms = await matches(four.battle);
    await setResult(ms[0].id, 1, 10, 1, 5);
    await setResult(ms[1].id, 1, 10, 1, 5);
    await asMod(() => db.query("update public.battle_matches set bet_a = 1, payout_a = 3 where id = $1", [ms[2].id]));
    await expect(setResult(ms[0].id, 1, 1, 1, 5)).rejects.toThrow(/next_match_started/);
  });

  it("el panel no cambia estados ni cruces a mano", async () => {
    const { battle } = await createBattle(2);
    await expect(
      asMod(() => db.query("update public.battles set status = 'finished' where id = $1", [battle])),
    ).rejects.toThrow(/invalid_status/);
    await asMod(() => db.query("select public.start_battle($1)", [battle]));
    const [final] = await matches(battle);
    await expect(
      asMod(() => db.query("update public.battle_matches set entry_a = null where id = $1", [final.id])),
    ).rejects.toThrow(/permission denied/);

    await asMod(() => db.query("select public.reset_battle($1)", [battle]));
    const { rows } = await db.query<{ status: string }>("select status from public.battles where id = $1", [battle]);
    expect(rows[0].status).toBe("open");
    expect(await matches(battle)).toHaveLength(0);
  });
});
