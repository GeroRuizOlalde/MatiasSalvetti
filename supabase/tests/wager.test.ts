import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let admin: { id: string };
let mod: { id: string };
let viewerA: { id: string };
let viewerB: { id: string };
let casino: string;

const submit = (user: { id: string }, accountId: string, path = `${user.id}/captura.png`) =>
  as(db, user, () =>
    db.query<{ id: string }>("select public.submit_casino_account($1, $2, $3) as id", [casino, accountId, path]),
  ).then((r) => r.rows[0].id);

const review = (id: string, approve: boolean, who = admin) =>
  as(db, who, () => db.query("select public.review_casino_account($1, $2, 'captura borrosa')", [id, approve]));

async function createRace(status = "published") {
  const { rows } = await as(db, admin, () =>
    db.query<{ id: string }>(
      `insert into public.wager_races (title, casino_id, starts_at, ends_at, prizes, status)
       values ('Race', $1, now() - interval '1 day', now() + interval '6 days', '{1000,500}', $2) returning id`,
      [casino, status],
    ),
  );
  return rows[0].id;
}

beforeAll(async () => {
  db = await createTestDb();
  admin = await createTwitchUser(db, "admin_wager");
  mod = await createTwitchUser(db, "mod_wager");
  viewerA = await createTwitchUser(db, "viewer_wager_a");
  viewerB = await createTwitchUser(db, "viewer_wager_b");
  await db.query("update public.profiles set role = 'admin' where id = $1", [admin.id]);
  await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
  for (const user of [viewerA, viewerB]) {
    await as(db, user, () => db.query("select public.accept_terms(1)"));
  }
  const { rows } = await db.query<{ id: string }>("select id from public.casinos where slug = '1xslots'");
  casino = rows[0].id;
}, 60_000);

describe("verificación de cuentas de casino", () => {
  it("la captura tiene que estar en la carpeta del usuario", async () => {
    await expect(submit(viewerA, "123456789", `${viewerB.id}/x.png`)).rejects.toThrow(/invalid_screenshot/);
    await expect(submit(viewerA, "no valido!")).rejects.toThrow(/invalid_account_id/);
  });

  it("una cuenta de casino no puede estar en dos usuarios", async () => {
    const id = await submit(viewerA, "1239456623");
    await expect(submit(viewerB, "1239456623")).rejects.toThrow(/account_taken/);

    const others = await as(db, viewerB, () => db.query("select id from public.casino_accounts where id = $1", [id]));
    expect(others.rows).toHaveLength(0);
    const own = await as(db, viewerA, () => db.query("select status from public.casino_accounts where id = $1", [id]));
    expect(own.rows).toEqual([{ status: "pending" }]);
  });

  it("solo el admin revisa; una aprobada no se puede volver a cargar", async () => {
    const { rows } = await db.query<{ id: string }>("select id from public.casino_accounts where user_id = $1", [
      viewerA.id,
    ]);
    await expect(review(rows[0].id, true, mod)).rejects.toThrow(/forbidden/);
    await review(rows[0].id, true);
    await expect(submit(viewerA, "999999999")).rejects.toThrow(/already_verified/);
  });

  it("si la rechazan, el ID queda libre y se puede corregir", async () => {
    const id = await submit(viewerB, "55555555");
    await review(id, false);
    const { rows } = await db.query<{ status: string; reject_reason: string }>(
      "select status, reject_reason from public.casino_accounts where id = $1",
      [id],
    );
    expect(rows[0]).toEqual({ status: "rejected", reject_reason: "captura borrosa" });
    expect(await submit(viewerB, "77777777")).toBe(id);
  });
});

describe("wager race", () => {
  it("importa el wager solo de cuentas aprobadas del casino y arma el ranking", async () => {
    const race = await createRace();
    const { rows: accB } = await db.query<{ id: string }>("select id from public.casino_accounts where user_id = $1", [
      viewerB.id,
    ]);
    await review(accB[0].id, true);

    const rows = [
      { account_id: "1239456623", wager: "1500.50" },
      { account_id: "77777777", wager: "9000" },
      { account_id: "desconocido", wager: "100" },
      { account_id: "1239456623", wager: "1" },
    ];
    const { rows: result } = await as(db, admin, () =>
      db.query<{ r: { matched: number; unmatched: string[] } }>("select public.import_wagers($1, $2) as r", [
        race,
        JSON.stringify(rows),
      ]),
    );
    expect(result[0].r).toEqual({ matched: 2, unmatched: ["desconocido"] });

    const { rows: board } = await as(db, "anon", () =>
      db.query<{ rank: number; user_id: string; masked_account: string; wager: string; prize: string | null }>(
        "select rank, user_id, masked_account, wager, prize from public.wager_leaderboard($1)",
        [race],
      ),
    );
    expect(board).toEqual([
      { rank: 1, user_id: viewerB.id, masked_account: "77•••77", wager: "9000.00", prize: "1000.00" },
      { rank: 2, user_id: viewerA.id, masked_account: "1239•••623", wager: "1500.50", prize: "500.00" },
    ]);

    await expect(as(db, viewerA, () => db.query("select public.import_wagers($1, '[]')", [race]))).rejects.toThrow(
      /forbidden/,
    );
    await expect(as(db, "anon", () => db.query("select * from public.wager_entries"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("los borradores no se ven ni tienen ranking público", async () => {
    const race = await createRace("draft");
    const { rows } = await as(db, "anon", () => db.query("select id from public.wager_races where id = $1", [race]));
    expect(rows).toHaveLength(0);
    const board = await as(db, "anon", () => db.query("select * from public.wager_leaderboard($1)", [race]));
    expect(board.rows).toHaveLength(0);
  });

  it("un baneado sale del ranking", async () => {
    const race = await createRace();
    await as(db, admin, () =>
      db.query("select public.import_wagers($1, $2)", [race, JSON.stringify([{ account_id: "77777777", wager: "5" }])]),
    );
    await db.query("update public.profiles set banned_at = now() where id = $1", [viewerB.id]);
    const board = await as(db, "anon", () => db.query("select * from public.wager_leaderboard($1)", [race]));
    expect(board.rows).toHaveLength(0);
    await db.query("update public.profiles set banned_at = null where id = $1", [viewerB.id]);
  });
});
