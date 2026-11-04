import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let mod: { id: string };

beforeAll(async () => {
  db = await createTestDb();
  mod = await createTwitchUser(db, "mod_borrar");
  await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
}, 60_000);

describe("borrar cuenta", () => {
  it("se puede borrar un viewer que participó en un hunt terminado", async () => {
    const viewer = await createTwitchUser(db, "viewer_borrar");
    await as(db, viewer, () => db.query("select public.accept_terms(1)"));
    const { rows } = await as(db, mod, () =>
      db.query<{ id: string }>(
        "insert into public.hunts (title, start_cost, status, calls_open, guesses_open) values ('Hunt', 1000, 'collecting', true, true) returning id",
      ),
    );
    const hunt = rows[0].id;
    await as(db, viewer, () => db.query("select public.submit_hunt_call($1, null, 'Mental')", [hunt]));
    await as(db, viewer, () => db.query("select public.submit_hunt_guess($1, 500)", [hunt]));
    const call = await db.query<{ id: string }>("select id from public.hunt_calls where hunt_id = $1", [hunt]);
    const bonus = await as(db, mod, () =>
      db.query<{ id: string }>("select public.accept_hunt_call($1, 100) as id", [call.rows[0].id]),
    );
    await as(db, mod, () =>
      db.query("update public.hunt_bonuses set payout = 50000 where id = $1", [bonus.rows[0].id]),
    );
    await as(db, mod, () => db.query("update public.hunts set status = 'finished' where id = $1", [hunt]));

    await db.query("delete from auth.users where id = $1", [viewer.id]);
    const left = await db.query("select id from public.profiles where id = $1", [viewer.id]);
    expect(left.rows).toHaveLength(0);
  });

  it("también si estuvo en un Bonus Buy y una Bonus Battle terminados, sorteos y replays", async () => {
    const viewer = await createTwitchUser(db, "viewer_borrar_2");
    await as(db, viewer, () => db.query("select public.accept_terms(1)"));

    const session = await db.query<{ id: string }>(
      "insert into public.buy_sessions (title, status) values ('Buys', 'live') returning id",
    );
    await db.query(
      "insert into public.buys (session_id, slot_name, bet, cost, payout, called_by) values ($1, 'Mental', 10, 1000, 5000, $2)",
      [session.rows[0].id, viewer.id],
    );
    await db.query("update public.buy_sessions set status = 'finished' where id = $1", [session.rows[0].id]);

    const battle = await db.query<{ id: string }>(
      "insert into public.battles (title, status, size) values ('Battle', 'open', 2) returning id",
    );
    await db.query("insert into public.battle_entries (battle_id, slot_name, called_by) values ($1, 'Mental', $2)", [
      battle.rows[0].id,
      viewer.id,
    ]);
    await db.query("insert into public.battle_entries (battle_id, slot_name) values ($1, 'Tombstone')", [
      battle.rows[0].id,
    ]);
    await db.query("select set_config('app.battle_internal', 'on', false)");
    await db.query("update public.battles set status = 'finished' where id = $1", [battle.rows[0].id]);
    await db.query("select set_config('app.battle_internal', 'off', false)");

    await db.query(
      "insert into public.replays (user_id, url, host, slot_name, status) values ($1, 'https://nolimitcity.com/replay/borrar', 'nolimitcity.com', 'Mental', 'approved')",
      [viewer.id],
    );

    await db.query("delete from auth.users where id = $1", [viewer.id]);
    expect((await db.query("select id from public.profiles where id = $1", [viewer.id])).rows).toHaveLength(0);
    // Lo que hizo queda, sin usuario.
    const buy = await db.query("select called_by from public.buys where session_id = $1", [session.rows[0].id]);
    expect(buy.rows).toEqual([{ called_by: null }]);
  });

  it("fuera de un borrado de cuenta, los hunts terminados siguen protegidos", async () => {
    const { rows } = await db.query<{ id: string }>(
      "select b.id from public.hunt_bonuses b join public.hunts h on h.id = b.hunt_id where h.status = 'finished' limit 1",
    );
    await expect(
      as(db, mod, () => db.query("update public.hunt_bonuses set payout = 1 where id = $1", [rows[0].id])),
    ).rejects.toThrow(/hunt_finished/);
  });
});
