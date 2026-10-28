import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let mod: { id: string };
let viewers: { id: string }[];

const SLOTS = ["Sugar Rush", "Gates of Olympus", "Fruit Party", "Big Bass Bonanza"];

async function createBattle(status = "open", size = 4) {
  const { rows } = await as(db, mod, () =>
    db.query<{ id: string }>(
      "insert into public.battles (title, status, size) values ('Battle', $1, $2) returning id",
      [status, size],
    ),
  );
  return rows[0].id;
}

async function callOf(battle: string, user: { id: string }) {
  const { rows } = await db.query<{ id: string; status: string }>(
    "select id, status from public.battle_calls where battle_id = $1 and user_id = $2",
    [battle, user.id],
  );
  return rows[0];
}

async function lastNotification(user: { id: string }) {
  const { rows } = await as(db, user, () =>
    db.query<{ kind: string; body: string }>(
      "select kind, body from public.notifications where audience = 'user' order by created_at desc, id limit 1",
    ),
  );
  return rows[0];
}

beforeAll(async () => {
  db = await createTestDb();
  mod = await createTwitchUser(db, "mod_battle");
  viewers = [];
  for (const i of [0, 1, 2, 3]) viewers.push(await createTwitchUser(db, `viewer_battle_${i}`));
  await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
  for (const user of viewers) await as(db, user, () => db.query("select public.accept_terms(1)"));
}, 60_000);

describe("calls en Bonus Battle", () => {
  it("solo con la battle abierta; una máquina por battle y sin cambios", async () => {
    const draft = await createBattle("draft");
    await expect(
      as(db, viewers[0], () => db.query("select public.submit_battle_call($1, null, 'Sugar Rush')", [draft])),
    ).rejects.toThrow(/calls_closed/);

    const battle = await createBattle();
    await as(db, viewers[0], () => db.query("select public.submit_battle_call($1, null, 'Sugar Rush')", [battle]));
    await expect(
      as(db, viewers[0], () => db.query("select public.submit_battle_call($1, null, 'Otro')", [battle])),
    ).rejects.toThrow(/call_already_sent/);
    await expect(
      as(db, viewers[1], () => db.query("select public.submit_battle_call($1, null, 'sugar rush')", [battle])),
    ).rejects.toThrow(/slot_taken/);
  });

  it("los calls aceptados arman el cuadro, avanza el que paga más y el campeón cobra", async () => {
    const battle = await createBattle();
    for (const [i, slot] of SLOTS.entries()) {
      await as(db, viewers[i], () => db.query("select public.submit_battle_call($1, null, $2)", [battle, slot]));
      const call = await callOf(battle, viewers[i]);
      await as(db, mod, () => db.query("select public.accept_battle_call($1)", [call.id]));
    }
    const entries = await db.query<{ slot_name: string; called_by: string }>(
      "select slot_name, called_by from public.battle_entries where battle_id = $1 order by seed",
      [battle],
    );
    expect(entries.rows.map((e) => e.called_by)).toEqual(viewers.map((v) => v.id));
    expect(await lastNotification(viewers[3])).toMatchObject({ kind: "call_accepted" });

    await as(db, mod, () => db.query("select public.start_battle($1)", [battle]));
    const { rows: ms } = await db.query<{ id: string }>(
      "select id from public.battle_matches where battle_id = $1 order by round, slot",
      [battle],
    );
    const result = (id: string, a: number, b: number) =>
      as(db, mod, () =>
        db.query(
          "update public.battle_matches set bet_a = 100, payout_a = $2, bet_b = 100, payout_b = $3 where id = $1",
          [id, a, b],
        ),
      );
    // Sugar Rush (0) le gana a Gates (1); Big Bass (3) le gana a Fruit Party (2).
    await result(ms[0].id, 5000, 1000);
    await result(ms[1].id, 2000, 9000);
    expect(await lastNotification(viewers[0])).toMatchObject({ kind: "battle_advanced" });
    expect(await lastNotification(viewers[1])).toMatchObject({ kind: "battle_out" });

    const before = await db.query<{ points: number }>("select points from public.profiles where id = $1", [
      viewers[3].id,
    ]);
    await result(ms[2].id, 3000, 8000);
    expect(await lastNotification(viewers[3])).toMatchObject({
      kind: "battle_won",
      body: "Big Bass Bonanza es el campeón.",
    });
    const after = await db.query<{ points: number }>("select points from public.profiles where id = $1", [
      viewers[3].id,
    ]);
    expect(after.rows[0].points).toBeGreaterThan(before.rows[0].points);
  });

  it("el cuadro arranca desde la instancia elegida y no entran más slots", async () => {
    const battle = await createBattle("open", 2);
    for (const [i, slot] of SLOTS.slice(0, 2).entries()) {
      await as(db, viewers[i], () => db.query("select public.submit_battle_call($1, null, $2)", [battle, slot]));
      const call = await callOf(battle, viewers[i]);
      await as(db, mod, () => db.query("select public.accept_battle_call($1)", [call.id]));
    }
    await expect(
      as(db, viewers[2], () => db.query("select public.submit_battle_call($1, null, 'Otro')", [battle])),
    ).rejects.toThrow(/battle_full/);
    await expect(
      as(db, mod, () => db.query("update public.battles set size = 64 where id = $1", [battle])),
    ).resolves.toBeDefined();
    await expect(as(db, mod, () => db.query("select public.start_battle($1)", [battle]))).rejects.toThrow(
      /invalid_entry_count/,
    );

    // 32avos: 64 slots, 6 rondas.
    const big = await createBattle("open", 64);
    for (let i = 1; i <= 64; i++) {
      await as(db, mod, () =>
        db.query("insert into public.battle_entries (battle_id, slot_name) values ($1, $2)", [big, `Slot ${i}`]),
      );
    }
    await as(db, mod, () => db.query("select public.start_battle($1)", [big]));
    const { rows } = await db.query<{ round: number; n: number }>(
      "select round, count(*)::int as n from public.battle_matches where battle_id = $1 group by round order by round",
      [big],
    );
    expect(rows.map((r) => r.n)).toEqual([32, 16, 8, 4, 2, 1]);
  });

  it("quitar el slot antes de arrancar libera al viewer", async () => {
    const battle = await createBattle();
    await as(db, viewers[0], () => db.query("select public.submit_battle_call($1, null, 'Wanted')", [battle]));
    const call = await callOf(battle, viewers[0]);
    const { rows } = await as(db, mod, () =>
      db.query<{ id: string }>("select public.accept_battle_call($1) as id", [call.id]),
    );
    await as(db, mod, () => db.query("delete from public.battle_entries where id = $1", [rows[0].id]));
    expect(await callOf(battle, viewers[0])).toBeUndefined();
  });
});
