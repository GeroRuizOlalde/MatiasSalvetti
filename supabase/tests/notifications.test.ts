import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let mod: { id: string };
let viewer: { id: string };
let other: { id: string };

type Row = { kind: string; title: string; body: string | null; link: string | null };

async function inbox(who: { id: string }, audience: "user" | "all" | "panel") {
  const { rows } = await as(db, who, () =>
    db.query<Row>(
      "select kind, title, body, link from public.notifications where audience = $1 order by created_at, kind",
      [audience],
    ),
  );
  return rows;
}

beforeAll(async () => {
  db = await createTestDb();
  mod = await createTwitchUser(db, "mod_notif");
  viewer = await createTwitchUser(db, "viewer_notif");
  other = await createTwitchUser(db, "otro_notif");
  await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
  await db.query("update public.profiles set display_name = 'Lucho' where id = $1", [viewer.id]);
  await as(db, viewer, () => db.query("select public.accept_terms(1)"));
}, 60_000);

describe("notificaciones", () => {
  it("avisa a todos cuando arranca un hunt y no cuando es borrador", async () => {
    const before = (await inbox(other, "all")).length;
    const { rows } = await as(db, mod, () =>
      db.query<{ id: string }>(
        "insert into public.hunts (title, start_cost) values ('Hunt del finde', 1000) returning id",
      ),
    );
    expect(await inbox(other, "all")).toHaveLength(before);

    await as(db, mod, () =>
      db.query("update public.hunts set status = 'collecting', calls_open = true where id = $1", [rows[0].id]),
    );
    const all = await inbox(other, "all");
    expect(all.at(-1)).toEqual({
      kind: "hunt_started",
      title: "Arrancó un Bonus Hunt",
      body: "Hunt del finde · pedí tu slot",
      link: `/bonus-hunt/${rows[0].id}`,
    });
  });

  it("call nuevo para el panel, respuesta para el viewer y posible tipeo", async () => {
    const { rows } = await as(db, mod, () =>
      db.query<{ id: string }>(
        "insert into public.hunts (title, start_cost, status, calls_open) values ('Hunt', 1000, 'collecting', true) returning id",
      ),
    );
    const hunt = rows[0].id;
    await as(db, viewer, () => db.query("select public.submit_hunt_call($1, null, 'Fruit Party')", [hunt]));

    const panel = await inbox(mod, "panel");
    expect(panel.at(-1)).toMatchObject({ kind: "call_new", body: "Lucho pidió Fruit Party · Hunt" });
    expect(await inbox(viewer, "panel")).toHaveLength(0);

    const call = await db.query<{ id: string }>("select id from public.hunt_calls where hunt_id = $1", [hunt]);
    const bonus = await as(db, mod, () =>
      db.query<{ id: string }>("select public.accept_hunt_call($1, 150) as id", [call.rows[0].id]),
    );
    expect((await inbox(viewer, "user")).at(-1)).toMatchObject({
      kind: "call_accepted",
      body: "Fruit Party entró a Hunt",
    });
    expect(await inbox(other, "user")).toHaveLength(0);

    await as(db, mod, () =>
      db.query("update public.hunt_bonuses set payout = 160000 where id = $1", [bonus.rows[0].id]),
    );
    expect((await inbox(mod, "panel")).at(-1)).toMatchObject({
      kind: "tipeo_hit",
      body: "Lucho · Fruit Party pagó 1066,67x",
    });

    await as(db, mod, () => db.query("select public.decide_tipeo($1, true)", [bonus.rows[0].id]));
    expect((await inbox(viewer, "user")).at(-1)).toMatchObject({ kind: "tipeo_given", title: "¡Te dieron tipeo!" });
  });

  it("marca como leídas por separado la web y el panel", async () => {
    await as(db, mod, () => db.query("select public.mark_notifications_read(true)"));
    const { rows } = await db.query<{ web: string; panel: string }>(
      "select notifications_read_at as web, panel_notifications_read_at as panel from public.profiles where id = $1",
      [mod.id],
    );
    expect(new Date(rows[0].panel).getTime()).toBeGreaterThanOrEqual(new Date(rows[0].web).getTime());
    await expect(as(db, "anon", () => db.query("select public.mark_notifications_read(false)"))).rejects.toThrow();
  });

  it("nadie las escribe ni las ve sin sesión", async () => {
    await expect(
      as(db, viewer, () =>
        db.query("insert into public.notifications (audience, kind, title) values ('all', 'x', 'Spam')"),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(as(db, "anon", () => db.query("select id from public.notifications"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("ganador del hunt", () => {
  it("al terminar, el call con mejor multi cobra el premio y recibe el aviso", async () => {
    const { rows } = await as(db, mod, () =>
      db.query<{ id: string }>(
        "insert into public.hunts (title, start_cost, status, calls_open) values ('Hunt final', 1000, 'collecting', true) returning id",
      ),
    );
    const hunt = rows[0].id;
    await as(db, viewer, () => db.query("select public.submit_hunt_call($1, null, 'Wanted Dead')", [hunt]));
    const call = await db.query<{ id: string }>("select id from public.hunt_calls where hunt_id = $1", [hunt]);
    const bonus = await as(db, mod, () =>
      db.query<{ id: string }>("select public.accept_hunt_call($1, 100) as id", [call.rows[0].id]),
    );
    await as(db, mod, () =>
      db.query("update public.hunt_bonuses set payout = 30000 where id = $1", [bonus.rows[0].id]),
    );
    // Un bono sin call que paga más no cuenta: el premio es para los viewers.
    await as(db, mod, () =>
      db.query("insert into public.hunt_bonuses (hunt_id, slot_name, bet, payout) values ($1, 'Otro', 100, 90000)", [
        hunt,
      ]),
    );

    const before = await db.query<{ points: number }>("select points from public.profiles where id = $1", [viewer.id]);
    await as(db, mod, () => db.query("update public.hunts set status = 'finished' where id = $1", [hunt]));
    const after = await db.query<{ points: number }>("select points from public.profiles where id = $1", [viewer.id]);
    expect(after.rows[0].points - before.rows[0].points).toBe(200);
    expect((await inbox(viewer, "user")).at(-1)).toMatchObject({
      kind: "hunt_winner",
      body: "Tu call Wanted Dead fue el mejor de Hunt final: 300,00x.",
    });

    // Reabrir y volver a terminar no paga dos veces.
    await as(db, mod, () => db.query("update public.hunts set status = 'opening' where id = $1", [hunt]));
    await as(db, mod, () => db.query("update public.hunts set status = 'finished' where id = $1", [hunt]));
    const again = await db.query<{ points: number }>("select points from public.profiles where id = $1", [viewer.id]);
    expect(again.rows[0].points).toBe(after.rows[0].points);
    const wins = (await inbox(viewer, "user")).filter((n) => n.kind === "hunt_winner");
    expect(wins).toHaveLength(1);
  });
});
