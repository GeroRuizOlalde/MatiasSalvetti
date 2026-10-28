import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let mod: { id: string };
let viewer: { id: string };

async function createHunt(title = "Hunt") {
  const { rows } = await as(db, mod, () =>
    db.query<{ id: string }>(
      "insert into public.hunts (title, start_cost, status, calls_open) values ($1, 1000, 'collecting', true) returning id",
      [title],
    ),
  );
  return rows[0].id;
}

async function callFor(hunt: string, slot: string) {
  await as(db, viewer, () => db.query("select public.submit_hunt_call($1, null, $2)", [hunt, slot]));
  const { rows } = await db.query<{ id: string }>(
    "select id from public.hunt_calls where hunt_id = $1 and user_id = $2",
    [hunt, viewer.id],
  );
  return rows[0].id;
}

beforeAll(async () => {
  db = await createTestDb();
  mod = await createTwitchUser(db, "mod_tipeo");
  viewer = await createTwitchUser(db, "viewer_tipeo");
  await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
  await as(db, viewer, () => db.query("select public.accept_terms(1)"));

  // Historial: Sugar Rush pagó 250x en un hunt; Big Bass pagó 110x justo en buys (no alcanza).
  const old = await createHunt("Hunt viejo");
  await as(db, mod, () =>
    db.query(
      "insert into public.hunt_bonuses (hunt_id, slot_name, bet, payout) values ($1, 'Sugar Rush', 100, 25000)",
      [old],
    ),
  );
  const { rows } = await as(db, mod, () =>
    db.query<{ id: string }>("insert into public.buy_sessions (title) values ('Buys viejos') returning id"),
  );
  await as(db, mod, () =>
    db.query(
      "insert into public.buys (session_id, slot_name, bet, cost, payout) values ($1, 'Big Bass Bonanza', 100, 10000, 11000)",
      [rows[0].id],
    ),
  );
}, 60_000);

describe("tipeos", () => {
  it("marca como tipeo solo los slots que pagaron más de 110x", async () => {
    const hunt = await createHunt();
    const call = await callFor(hunt, "sugar rush");
    const { rows } = await as(db, mod, () =>
      db.query<{ call_id: string; multi: string; source: string; title: string }>(
        "select * from public.hunt_tipeo_candidates($1)",
        [hunt],
      ),
    );
    expect(rows).toEqual([{ call_id: call, multi: "250.00", source: "hunt", title: "Hunt viejo" }]);

    const other = await createHunt();
    await callFor(other, "Big Bass Bonanza");
    const none = await as(db, mod, () => db.query("select * from public.hunt_tipeo_candidates($1)", [other]));
    expect(none.rows).toHaveLength(0);
  });

  it("aceptar como tipeo crea el bono y lo anota en la lista", async () => {
    const hunt = await createHunt();
    const call = await callFor(hunt, "Sugar Rush");
    const { rows } = await as(db, mod, () =>
      db.query<{ bonus: string }>("select public.accept_hunt_call_as_tipeo($1, 200) as bonus", [call]),
    );
    const tipeo = await as(db, mod, () =>
      db.query<{ bonus_id: string; user_id: string; ref_multi: string; ref_source: string }>(
        "select bonus_id, user_id, ref_multi, ref_source from public.tipeos where call_id = $1",
        [call],
      ),
    );
    expect(tipeo.rows).toEqual([
      { bonus_id: rows[0].bonus, user_id: viewer.id, ref_multi: "250.00", ref_source: "hunt" },
    ]);
    const status = await db.query<{ status: string }>("select status from public.hunt_calls where id = $1", [call]);
    expect(status.rows[0].status).toBe("accepted");
  });

  it("no deja aceptar como tipeo un slot que no califica", async () => {
    const hunt = await createHunt();
    const call = await callFor(hunt, "Big Bass Bonanza");
    await expect(
      as(db, mod, () => db.query("select public.accept_hunt_call_as_tipeo($1, 100)", [call])),
    ).rejects.toThrow(/not_tipeo/);
  });

  it("los viewers no ven ni aceptan tipeos", async () => {
    const hunt = await createHunt();
    const call = await callFor(hunt, "Sugar Rush");
    await expect(
      as(db, viewer, () => db.query("select * from public.hunt_tipeo_candidates($1)", [hunt])),
    ).rejects.toThrow(/forbidden/);
    await expect(
      as(db, viewer, () => db.query("select public.accept_hunt_call_as_tipeo($1, 100)", [call])),
    ).rejects.toThrow(/forbidden/);
    const list = await as(db, viewer, () => db.query("select id from public.tipeos"));
    expect(list.rows).toHaveLength(0);
  });
});
