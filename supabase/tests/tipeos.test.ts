import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let mod: { id: string };
let viewer: { id: string };

/** Hunt con un bono que vino del call del viewer, abierto con el pago indicado. */
async function calledBonus(bet: number, payout: number | null) {
  const { rows } = await as(db, mod, () =>
    db.query<{ id: string }>(
      "insert into public.hunts (title, start_cost, status, calls_open) values ('Hunt', 1000, 'collecting', true) returning id",
    ),
  );
  const hunt = rows[0].id;
  await as(db, viewer, () => db.query("select public.submit_hunt_call($1, null, 'Sugar Rush')", [hunt]));
  const call = await db.query<{ id: string }>("select id from public.hunt_calls where hunt_id = $1", [hunt]);
  const bonus = await as(db, mod, () =>
    db.query<{ id: string }>("select public.accept_hunt_call($1, $2) as id", [call.rows[0].id, bet]),
  );
  if (payout !== null) {
    await as(db, mod, () =>
      db.query("update public.hunt_bonuses set payout = $2 where id = $1", [bonus.rows[0].id, payout]),
    );
  }
  return { hunt, bonus: bonus.rows[0].id };
}

beforeAll(async () => {
  db = await createTestDb();
  mod = await createTwitchUser(db, "mod_tipeo");
  viewer = await createTwitchUser(db, "viewer_tipeo");
  await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
  await as(db, viewer, () => db.query("select public.accept_terms(1)"));
}, 60_000);

describe("tipeos", () => {
  it("da tipeo al viewer del call cuando el bono pagó más de 110x", async () => {
    const { hunt, bonus } = await calledBonus(150, 160000);
    await as(db, mod, () => db.query("select public.decide_tipeo($1, true)", [bonus]));
    const { rows } = await as(db, mod, () =>
      db.query(
        "select hunt_id, user_id, slot_name, bet, payout, multi, status from public.tipeos where bonus_id = $1",
        [bonus],
      ),
    );
    expect(rows).toEqual([
      {
        hunt_id: hunt,
        user_id: viewer.id,
        slot_name: "Sugar Rush",
        bet: "150.00",
        payout: "160000.00",
        multi: "1066.67",
        status: "given",
      },
    ]);
  });

  it("se puede descartar y cambiar de idea", async () => {
    const { bonus } = await calledBonus(100, 20000);
    await as(db, mod, () => db.query("select public.decide_tipeo($1, false)", [bonus]));
    await as(db, mod, () => db.query("select public.decide_tipeo($1, true)", [bonus]));
    const { rows } = await as(db, mod, () => db.query("select status from public.tipeos where bonus_id = $1", [bonus]));
    expect(rows).toEqual([{ status: "given" }]);
  });

  it("no deja dar tipeo si el bono no pasó los 110x o no está abierto", async () => {
    const low = await calledBonus(100, 11000);
    await expect(as(db, mod, () => db.query("select public.decide_tipeo($1, true)", [low.bonus]))).rejects.toThrow(
      /not_tipeo/,
    );
    const closed = await calledBonus(100, null);
    await expect(as(db, mod, () => db.query("select public.decide_tipeo($1, true)", [closed.bonus]))).rejects.toThrow(
      /not_tipeo/,
    );
  });

  it("no deja dar tipeo a un bono que no vino de un call", async () => {
    const { hunt } = await calledBonus(100, null);
    const { rows } = await as(db, mod, () =>
      db.query<{ id: string }>(
        "insert into public.hunt_bonuses (hunt_id, slot_name, bet, payout) values ($1, 'Otro', 100, 50000) returning id",
        [hunt],
      ),
    );
    await expect(as(db, mod, () => db.query("select public.decide_tipeo($1, true)", [rows[0].id]))).rejects.toThrow(
      /bonus_not_called/,
    );
  });

  it("los viewers no ven ni dan tipeos, y borrar el bono borra el tipeo", async () => {
    const { bonus } = await calledBonus(100, 30000);
    await expect(as(db, viewer, () => db.query("select public.decide_tipeo($1, true)", [bonus]))).rejects.toThrow(
      /forbidden/,
    );
    await as(db, mod, () => db.query("select public.decide_tipeo($1, true)", [bonus]));
    const seen = await as(db, viewer, () => db.query("select id from public.tipeos"));
    expect(seen.rows).toHaveLength(0);

    await as(db, mod, () => db.query("delete from public.hunt_bonuses where id = $1", [bonus]));
    const left = await db.query("select id from public.tipeos where bonus_id = $1", [bonus]);
    expect(left.rows).toHaveLength(0);
  });
});
