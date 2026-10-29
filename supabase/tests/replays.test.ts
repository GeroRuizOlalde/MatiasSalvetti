import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let mod: { id: string };
let viewer: { id: string };
let other: { id: string };

const submit = (
  who: { id: string },
  url: string,
  slot = "Mental",
  amounts: { bet?: number; bonus?: number; payout?: number } = {},
) =>
  as(db, who, () =>
    db.query<{ id: string }>(
      "select public.submit_replay(p_url => $1, p_slot_name => $2, p_bet => $3, p_bonus_cost => $4, p_payout => $5) as id",
      [url, slot, amounts.bet ?? null, amounts.bonus ?? null, amounts.payout ?? null],
    ),
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
    const id = await submit(viewer, "https://www.ppreplaylink.net/IKfLBegbRp", "Gates of Olympus", {
      bet: 200,
      bonus: 20000,
      payout: 500000,
    });
    const own = await as(db, viewer, () =>
      db.query("select host, slot_name, bet, bonus_cost, payout, multi, status from public.replays where id = $1", [
        id,
      ]),
    );
    expect(own.rows).toEqual([
      {
        host: "ppreplaylink.net",
        slot_name: "Gates of Olympus",
        bet: "200.00",
        bonus_cost: "20000.00",
        payout: "500000.00",
        multi: "2500.00",
        status: "pending",
      },
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

  it("me gusta y comentarios en replays publicados", async () => {
    const id = await submit(viewer, "https://nolimitcity.com/replay/social");
    // Sin publicar no se puede.
    await expect(as(db, other, () => db.query("select public.toggle_replay_like($1)", [id]))).rejects.toThrow(
      /not_found/,
    );
    await as(db, mod, () => db.query("select public.review_replay($1, true)", [id]));

    const like = await as(db, other, () =>
      db.query<{ liked: boolean }>("select public.toggle_replay_like($1) as liked", [id]),
    );
    expect(like.rows[0].liked).toBe(true);
    await as(db, viewer, () => db.query("select public.toggle_replay_like($1)", [id]));
    const unlike = await as(db, other, () =>
      db.query<{ liked: boolean }>("select public.toggle_replay_like($1) as liked", [id]),
    );
    expect(unlike.rows[0].liked).toBe(false);

    const comment = await as(db, other, () =>
      db.query<{ id: string }>("select public.add_replay_comment($1, '  ¡Qué locura!  ') as id", [id]),
    );
    await expect(as(db, other, () => db.query("select public.add_replay_comment($1, '   ')", [id]))).rejects.toThrow(
      /invalid_comment/,
    );
    const counts = await as(db, "anon", () =>
      db.query("select likes_count, comments_count from public.replays where id = $1", [id]),
    );
    expect(counts.rows).toEqual([{ likes_count: 1, comments_count: 1 }]);
    const visible = await as(db, "anon", () =>
      db.query("select body from public.replay_comments where replay_id = $1", [id]),
    );
    expect(visible.rows).toEqual([{ body: "¡Qué locura!" }]);

    // Al dueño le llega el aviso del comentario.
    const notice = await as(db, viewer, () =>
      db.query("select title from public.notifications where kind = 'replay_comment'"),
    );
    expect(notice.rows).toHaveLength(1);

    // Nadie escribe directo, y solo el autor (o el panel) borra su comentario.
    await expect(
      as(db, other, () =>
        db.query("insert into public.replay_likes (replay_id, user_id) values ($1, $2)", [id, other.id]),
      ),
    ).rejects.toThrow(/permission denied/);
    await as(db, viewer, () => db.query("delete from public.replay_comments where id = $1", [comment.rows[0].id]));
    expect(
      (await db.query("select id from public.replay_comments where id = $1", [comment.rows[0].id])).rows,
    ).toHaveLength(1);
    await as(db, other, () => db.query("delete from public.replay_comments where id = $1", [comment.rows[0].id]));
    const after = await db.query("select comments_count from public.replays where id = $1", [id]);
    expect(after.rows).toEqual([{ comments_count: 0 }]);
  });
});
