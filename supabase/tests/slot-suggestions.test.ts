import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let mod: { id: string };
const viewers: { id: string }[] = [];

beforeAll(async () => {
  db = await createTestDb();
  mod = await createTwitchUser(db, "mod_sugeridos");
  await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
  for (const login of ["viewer_s1", "viewer_s2", "viewer_s3", "viewer_s4"]) {
    const viewer = await createTwitchUser(db, login);
    await as(db, viewer, () => db.query("select public.accept_terms(1)"));
    viewers.push(viewer);
  }
}, 60_000);

async function openHunt() {
  const { rows } = await as(db, mod, () =>
    db.query<{ id: string }>(
      "insert into public.hunts (title, start_cost, status, calls_open) values ('Hunt', 1000, 'collecting', true) returning id",
    ),
  );
  return rows[0].id;
}

const call = (viewer: { id: string }, hunt: string, name: string) =>
  as(db, viewer, () => db.query("select public.submit_hunt_call($1, null, $2)", [hunt, name]));

const suggestion = async (key: string) =>
  (
    await db.query<{ id: string; times: number; status: string; source: string }>(
      "select id, times, status, source from public.slot_suggestions where name_key = $1",
      [key],
    )
  ).rows[0];

describe("slots sugeridos", () => {
  it("un slot que no está en el catálogo queda sugerido y suma los pedidos", async () => {
    await call(viewers[0], await openHunt(), "Le Bandit");
    await call(viewers[1], await openHunt(), "  le   BANDIT ");
    expect(await suggestion("le bandit")).toMatchObject({ times: 2, status: "pending", source: "hunt" });
  });

  it("si está en el catálogo con el mismo nombre, el call se vincula solo", async () => {
    const { rows } = await db.query<{ id: string }>(
      "insert into public.slots (name, provider) values ('Sugar Rush', 'Pragmatic Play') returning id",
    );
    const hunt = await openHunt();
    await call(viewers[0], hunt, "sugar rush");
    const linked = await db.query("select slot_id from public.hunt_calls where hunt_id = $1", [hunt]);
    expect(linked.rows).toEqual([{ slot_id: rows[0].id }]);
    expect(await suggestion("sugar rush")).toBeUndefined();
  });

  it("el panel lo agrega con proveedor y quedan vinculados los calls", async () => {
    const hunt = await openHunt();
    await call(viewers[2], hunt, "Wanted Dead");
    const { id } = await suggestion("wanted dead");
    const added = await as(db, mod, () =>
      db.query<{ slot: string }>("select public.add_slot_suggestion($1, $2, $3) as slot", [
        id,
        "Wanted Dead or a Wild",
        "Hacksaw",
      ]),
    );
    const slot = await db.query("select name, provider from public.slots where id = $1", [added.rows[0].slot]);
    expect(slot.rows).toEqual([{ name: "Wanted Dead or a Wild", provider: "Hacksaw" }]);
    const linked = await db.query("select slot_id from public.hunt_calls where hunt_id = $1", [hunt]);
    expect(linked.rows).toEqual([{ slot_id: added.rows[0].slot }]);
    expect(await suggestion("wanted dead")).toMatchObject({ status: "added" });
  });

  it("descartada no vuelve, y los viewers no ven ni tocan las sugerencias", async () => {
    await call(viewers[3], await openHunt(), "Slot Inventado");
    const { id } = await suggestion("slot inventado");
    const seen = await as(db, viewers[3], () => db.query("select id from public.slot_suggestions"));
    expect(seen.rows).toHaveLength(0);
    await expect(as(db, viewers[3], () => db.query("select public.dismiss_slot_suggestion($1)", [id]))).rejects.toThrow(
      /forbidden/,
    );
    await as(db, mod, () => db.query("select public.dismiss_slot_suggestion($1)", [id]));
    await call(viewers[0], await openHunt(), "Slot Inventado");
    expect(await suggestion("slot inventado")).toMatchObject({ status: "dismissed", times: 1 });
  });

  it("el panel puede corregir nombre y proveedor antes de agregarlo", async () => {
    await call(viewers[1], await openHunt(), "Mental 2");
    const { id } = await suggestion("mental 2");
    const { rows } = await as(db, mod, () =>
      db.query("update public.slot_suggestions set provider = 'Nolimit City' where id = $1 returning provider", [id]),
    );
    expect(rows).toEqual([{ provider: "Nolimit City" }]);
  });

  it("se puede agregar aunque el slot ya sea un bono de un hunt terminado", async () => {
    const hunt = await openHunt();
    await call(viewers[2], hunt, "Tombstone Begins");
    const callRow = await db.query<{ id: string }>("select id from public.hunt_calls where hunt_id = $1", [hunt]);
    const bonus = await as(db, mod, () =>
      db.query<{ id: string }>("select public.accept_hunt_call($1, 100) as id", [callRow.rows[0].id]),
    );
    await as(db, mod, () => db.query("update public.hunt_bonuses set payout = 500 where id = $1", [bonus.rows[0].id]));
    await as(db, mod, () => db.query("update public.hunts set status = 'finished' where id = $1", [hunt]));

    const { id } = await suggestion("tombstone begins");
    const added = await as(db, mod, () =>
      db.query<{ slot: string }>("select public.add_slot_suggestion($1, 'Tombstone Begins', 'Nolimit City') as slot", [
        id,
      ]),
    );
    expect(added.rows[0].slot).toBeTruthy();
    // El bono del hunt cerrado queda como estaba; el call sí se vincula.
    const bonusRow = await db.query("select slot_id from public.hunt_bonuses where id = $1", [bonus.rows[0].id]);
    expect(bonusRow.rows).toEqual([{ slot_id: null }]);
    const linked = await db.query("select slot_id from public.hunt_calls where id = $1", [callRow.rows[0].id]);
    expect(linked.rows).toEqual([{ slot_id: added.rows[0].slot }]);
  });
});
