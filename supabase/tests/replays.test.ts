import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let mod: { id: string };
let viewer: { id: string };
let other: { id: string };

const submit = (who: { id: string }, url: string, slot = "Mental", multi: number | null = null) =>
  as(db, who, () =>
    db.query<{ id: string }>("select public.submit_replay($1, null, $2, $3) as id", [url, slot, multi]),
  ).then((r) => r.rows[0].id);

beforeAll(async () => {
  db = await createTestDb();
  mod = await createTwitchUser(db, "mod_replay");
  viewer = await createTwitchUser(db, "viewer_replay");
  other = await createTwitchUser(db, "other_replay");
  await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
  await as(db, viewer, () => db.query("select public.accept_terms(1)"));
  await as(db, other, () => db.query("select public.accept_terms(1)"));
}, 60_000);

describe("replays", () => {
  it("se manda, queda pendiente y solo se publica cuando el panel lo aprueba", async () => {
    const id = await submit(viewer, "https://www.ppreplaylink.net/IKfLBegbRp", "Gates of Olympus", 2500);
    const own = await as(db, viewer, () =>
      db.query("select host, slot_name, multi, status from public.replays where id = $1", [id]),
    );
    expect(own.rows).toEqual([
      { host: "ppreplaylink.net", slot_name: "Gates of Olympus", multi: "2500.00", status: "pending" },
    ]);

    const hidden = await as(db, "anon", () => db.query("select id from public.replays where id = $1", [id]));
    expect(hidden.rows).toHaveLength(0);
    const panel = await as(db, mod, () =>
      db.query<{ kind: string }>("select kind from public.notifications where kind = 'replay_new'"),
    );
    expect(panel.rows.length).toBeGreaterThan(0);

    await as(db, mod, () => db.query("select public.review_replay($1, true)", [id]));
    const visible = await as(db, "anon", () => db.query("select status from public.replays where id = $1", [id]));
    expect(visible.rows).toEqual([{ status: "approved" }]);
    const notice = await as(db, viewer, () =>
      db.query("select title from public.notifications where kind = 'replay_approved'"),
    );
    expect(notice.rows).toHaveLength(1);
  });

  it("rechazar guarda el motivo y se lo avisa al viewer", async () => {
    const id = await submit(viewer, "https://nolimitcity.com/replay/abc123");
    await as(db, mod, () => db.query("select public.review_replay($1, false, 'No se ve el bono')", [id]));
    const { rows } = await as(db, viewer, () =>
      db.query("select status, reject_reason from public.replays where id = $1", [id]),
    );
    expect(rows).toEqual([{ status: "rejected", reject_reason: "No se ve el bono" }]);
    const notice = await as(db, viewer, () =>
      db.query("select body from public.notifications where kind = 'replay_rejected'"),
    );
    expect(notice.rows).toEqual([{ body: "No se ve el bono" }]);
  });

  it("solo acepta links https y no repetidos", async () => {
    await expect(submit(viewer, "http://nolimitcity.com/replay/x")).rejects.toThrow(/invalid_url/);
    await expect(submit(viewer, "javascript:alert(1)")).rejects.toThrow(/invalid_url/);
    await expect(submit(viewer, "https://nolimitcity.com/replay/con espacio")).rejects.toThrow(/invalid_url/);
    await submit(viewer, "https://nolimitcity.com/replay/unico");
    await expect(submit(other, "https://nolimitcity.com/replay/unico")).rejects.toThrow(/replay_duplicate/);
  });

  it("los viewers no ven los pendientes de otros, no los aprueban y solo borran los suyos sin revisar", async () => {
    const id = await submit(other, "https://nolimitcity.com/replay/de-otro");
    const seen = await as(db, viewer, () => db.query("select id from public.replays where id = $1", [id]));
    expect(seen.rows).toHaveLength(0);
    await expect(as(db, viewer, () => db.query("select public.review_replay($1, true)", [id]))).rejects.toThrow(
      /forbidden/,
    );
    await expect(
      as(db, other, () => db.query("update public.replays set status = 'approved' where id = $1", [id])),
    ).rejects.toThrow(/permission denied/);

    await as(db, viewer, () => db.query("delete from public.replays where id = $1", [id]));
    expect((await db.query("select id from public.replays where id = $1", [id])).rows).toHaveLength(1);
    await as(db, other, () => db.query("delete from public.replays where id = $1", [id]));
    expect((await db.query("select id from public.replays where id = $1", [id])).rows).toHaveLength(0);
  });

  it("los proveedores los maneja el panel", async () => {
    const list = await as(db, "anon", () => db.query("select domain from public.replay_providers order by domain"));
    expect(list.rows).toEqual([{ domain: "nolimitcity.com" }, { domain: "ppreplaylink.net" }]);
    await expect(
      as(db, viewer, () =>
        db.query("insert into public.replay_providers (name, domain) values ('Hacksaw', 'hacksawgaming.com')"),
      ),
    ).rejects.toThrow(/row-level security/);
    await as(db, mod, () =>
      db.query("insert into public.replay_providers (name, domain) values ('Hacksaw', 'hacksawgaming.com')"),
    );
    await expect(
      as(db, mod, () =>
        db.query("insert into public.replay_providers (name, domain) values ('Mal', 'https://algo.com/x')"),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});
