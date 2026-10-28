import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let mod: { id: string };
let viewerA: { id: string };
let viewerB: { id: string };

async function createSession(status = "live") {
  const { rows } = await as(db, mod, () =>
    db.query<{ id: string }>("insert into public.buy_sessions (title, status) values ('Buys', $1) returning id", [
      status,
    ]),
  );
  return rows[0].id;
}

async function callOf(session: string, user: { id: string }) {
  const { rows } = await db.query<{ id: string; status: string }>(
    "select id, status from public.buy_calls where session_id = $1 and user_id = $2",
    [session, user.id],
  );
  return rows[0];
}

beforeAll(async () => {
  db = await createTestDb();
  mod = await createTwitchUser(db, "mod_buys");
  viewerA = await createTwitchUser(db, "viewer_buys_a");
  viewerB = await createTwitchUser(db, "viewer_buys_b");
  await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
  for (const user of [viewerA, viewerB]) await as(db, user, () => db.query("select public.accept_terms(1)"));
}, 60_000);

describe("calls en Bonus Buys", () => {
  it("solo con la sesión en vivo y los calls abiertos", async () => {
    const draft = await createSession("draft");
    await expect(
      as(db, viewerA, () => db.query("select public.submit_buy_call($1, null, 'Sugar Rush')", [draft])),
    ).rejects.toThrow(/calls_closed/);
  });

  it("el panel acepta el call como compra del viewer, y no se puede cambiar", async () => {
    const session = await createSession();
    await as(db, viewerA, () => db.query("select public.submit_buy_call($1, null, 'Sugar Rush')", [session]));
    await expect(
      as(db, viewerA, () => db.query("select public.submit_buy_call($1, null, 'Otro')", [session])),
    ).rejects.toThrow(/call_already_sent/);

    const call = await callOf(session, viewerA);
    await expect(
      as(db, viewerB, () => db.query("select public.accept_buy_call($1, 100, 10000)", [call.id])),
    ).rejects.toThrow(/forbidden/);
    await as(db, mod, () => db.query("select public.accept_buy_call($1, 100, 10000)", [call.id]));
    const { rows } = await db.query("select slot_name, bet, cost, called_by from public.buys where session_id = $1", [
      session,
    ]);
    expect(rows).toEqual([{ slot_name: "Sugar Rush", bet: "100.00", cost: "10000.00", called_by: viewerA.id }]);
  });

  it("una máquina por sesión; rechazar o borrar la compra la libera", async () => {
    const session = await createSession();
    await as(db, viewerA, () => db.query("select public.submit_buy_call($1, null, 'Gates of Olympus')", [session]));
    await expect(
      as(db, viewerB, () => db.query("select public.submit_buy_call($1, null, 'gates of olympus')", [session])),
    ).rejects.toThrow(/slot_taken/);

    const taken = await as(db, "anon", () =>
      db.query<{ slot_name: string }>("select slot_name from public.buy_taken_slots($1)", [session]),
    );
    expect(taken.rows).toEqual([{ slot_name: "Gates of Olympus" }]);

    const first = await callOf(session, viewerA);
    await as(db, mod, () => db.query("select public.reject_buy_call($1)", [first.id]));
    await as(db, viewerB, () => db.query("select public.submit_buy_call($1, null, 'Gates of Olympus')", [session]));

    const second = await callOf(session, viewerB);
    const { rows } = await as(db, mod, () =>
      db.query<{ id: string }>("select public.accept_buy_call($1, 100, 10000) as id", [second.id]),
    );
    await as(db, mod, () => db.query("delete from public.buys where id = $1", [rows[0].id]));
    expect(await callOf(session, viewerB)).toBeUndefined();
  });

  it("recomienda y da tipeo cuando la compra paga más de 110x", async () => {
    const session = await createSession();
    await as(db, viewerA, () => db.query("select public.submit_buy_call($1, null, 'Fruit Party')", [session]));
    const call = await callOf(session, viewerA);
    const { rows } = await as(db, mod, () =>
      db.query<{ id: string }>("select public.accept_buy_call($1, 150, 15000) as id", [call.id]),
    );
    const buy = rows[0].id;
    await as(db, mod, () => db.query("update public.buys set payout = 160000 where id = $1", [buy]));

    const panel = await as(db, mod, () =>
      db.query<{ kind: string; link: string }>(
        "select kind, link from public.notifications where audience = 'panel' order by created_at desc limit 1",
      ),
    );
    expect(panel.rows[0]).toEqual({ kind: "tipeo_hit", link: `/panel/buys/${session}` });

    await as(db, mod, () => db.query("select public.decide_buy_tipeo($1, true)", [buy]));
    const tipeo = await as(db, mod, () =>
      db.query("select session_id, user_id, multi, status from public.tipeos where buy_id = $1", [buy]),
    );
    expect(tipeo.rows).toEqual([{ session_id: session, user_id: viewerA.id, multi: "1066.67", status: "given" }]);

    const mine = await as(db, viewerA, () =>
      db.query<{ kind: string; link: string }>(
        "select kind, link from public.notifications where audience = 'user' order by created_at desc limit 1",
      ),
    );
    expect(mine.rows[0]).toEqual({ kind: "tipeo_given", link: `/bonus-buys/${session}` });
  });
});
