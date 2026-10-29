import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let mod: { id: string };
let viewerA: { id: string };
let viewerB: { id: string };
let newbie: { id: string };

async function createHunt(values: Record<string, unknown> = {}) {
  const { rows } = await as(db, mod, () =>
    db.query<{ id: string }>(
      "insert into public.hunts (title, start_cost, status, calls_open, guesses_open) values ($1, $2, $3, $4, $5) returning id",
      [
        values.title ?? "Hunt de prueba",
        values.start_cost ?? 10000,
        values.status ?? "collecting",
        values.calls_open ?? true,
        values.guesses_open ?? true,
      ],
    ),
  );
  return rows[0].id;
}

async function addBonus(hunt: string, bet: number, payout: number | null = null) {
  const { rows } = await as(db, mod, () =>
    db.query<{ id: string; position: number }>(
      "insert into public.hunt_bonuses (hunt_id, slot_name, bet, payout) values ($1, 'Slot', $2, $3) returning id, position",
      [hunt, bet, payout],
    ),
  );
  return rows[0];
}

beforeAll(async () => {
  db = await createTestDb();
  mod = await createTwitchUser(db, "mod_hunt");
  viewerA = await createTwitchUser(db, "viewer_hunt_a");
  viewerB = await createTwitchUser(db, "viewer_hunt_b");
  newbie = await createTwitchUser(db, "viewer_sin_bases");
  await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
  for (const user of [viewerA, viewerB]) {
    await as(db, user, () => db.query("select public.accept_terms(1)"));
  }
}, 60_000);

describe("hunts", () => {
  it("los borradores solo los ve el panel", async () => {
    const draft = await createHunt({ status: "draft", calls_open: false, guesses_open: false });
    const anon = await as(db, "anon", () => db.query("select id from public.hunts where id = $1", [draft]));
    expect(anon.rows).toHaveLength(0);
    const panel = await as(db, mod, () => db.query("select id from public.hunts where id = $1", [draft]));
    expect(panel.rows).toHaveLength(1);
  });

  it("un viewer no puede crear hunts ni cargar bonos", async () => {
    await expect(
      as(db, viewerA, () => db.query("insert into public.hunts (title, start_cost) values ('x', 1)")),
    ).rejects.toThrow(/row-level security/);
    const hunt = await createHunt();
    await expect(
      as(db, viewerA, () =>
        db.query("insert into public.hunt_bonuses (hunt_id, slot_name, bet) values ($1, 'x', 1)", [hunt]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("numera los bonos y marca la apertura", async () => {
    const hunt = await createHunt();
    const first = await addBonus(hunt, 100);
    const second = await addBonus(hunt, 200);
    expect([first.position, second.position]).toEqual([1, 2]);

    await as(db, mod, () => db.query("update public.hunt_bonuses set payout = 5000 where id = $1", [first.id]));
    const { rows } = await db.query<{ opened_at: string | null }>(
      "select opened_at from public.hunt_bonuses where id = $1",
      [first.id],
    );
    expect(rows[0].opened_at).not.toBeNull();
  });

  it("cada cambio de bono actualiza el hunt (para Realtime)", async () => {
    const hunt = await createHunt();
    await db.query("update public.hunts set updated_at = now() - interval '1 hour' where id = $1", [hunt]);
    const bonus = await addBonus(hunt, 100);
    await db.query("update public.hunts set updated_at = now() - interval '1 hour' where id = $1", [hunt]);
    await as(db, mod, () => db.query("delete from public.hunt_bonuses where id = $1", [bonus.id]));
    const { rows } = await db.query<{ fresh: boolean }>(
      "select updated_at > now() - interval '1 minute' as fresh from public.hunts where id = $1",
      [hunt],
    );
    expect(rows[0].fresh).toBe(true);
  });

  it("no cierra con bonos sin abrir", async () => {
    const hunt = await createHunt();
    await addBonus(hunt, 100);
    await expect(
      as(db, mod, () => db.query("update public.hunts set status = 'finished' where id = $1", [hunt])),
    ).rejects.toThrow(/bonuses_pending/);
  });
});

describe("calls", () => {
  it("exige haber aceptado las bases", async () => {
    const hunt = await createHunt();
    await expect(
      as(db, newbie, () => db.query("select public.submit_hunt_call($1, null, 'Sugar Rush')", [hunt])),
    ).rejects.toThrow(/cannot_participate/);
  });

  it("rechaza calls con el hunt cerrado a pedidos", async () => {
    const hunt = await createHunt({ calls_open: false });
    await expect(
      as(db, viewerA, () => db.query("select public.submit_hunt_call($1, null, 'Sugar Rush')", [hunt])),
    ).rejects.toThrow(/calls_closed/);
  });

  it("un call por viewer, sin cambios, y el mod lo acepta como bono", async () => {
    const hunt = await createHunt();
    await as(db, viewerA, () => db.query("select public.submit_hunt_call($1, null, 'Gates of Olympus')", [hunt]));
    await expect(
      as(db, viewerA, () => db.query("select public.submit_hunt_call($1, null, 'Sugar Rush')", [hunt])),
    ).rejects.toThrow(/call_already_sent/);

    const own = await as(db, viewerA, () =>
      db.query<{ id: string; slot_name: string }>("select id, slot_name from public.hunt_calls where hunt_id = $1", [
        hunt,
      ]),
    );
    expect(own.rows).toHaveLength(1);
    expect(own.rows[0].slot_name).toBe("Gates of Olympus");

    const others = await as(db, viewerB, () => db.query("select id from public.hunt_calls where hunt_id = $1", [hunt]));
    expect(others.rows).toHaveLength(0);

    await expect(
      as(db, viewerB, () => db.query("select public.accept_hunt_call($1, 100)", [own.rows[0].id])),
    ).rejects.toThrow(/forbidden/);

    await as(db, mod, () => db.query("select public.accept_hunt_call($1, 250)", [own.rows[0].id]));
    const { rows: bonuses } = await db.query<{ slot_name: string; bet: string; called_by: string }>(
      "select slot_name, bet, called_by from public.hunt_bonuses where hunt_id = $1",
      [hunt],
    );
    expect(bonuses).toEqual([{ slot_name: "Gates of Olympus", bet: "250.00", called_by: viewerA.id }]);

    await expect(
      as(db, viewerA, () => db.query("select public.submit_hunt_call($1, null, 'Otro')", [hunt])),
    ).rejects.toThrow(/call_already_accepted/);
  });

  it("un call rechazado no se puede volver a pedir, pero la máquina queda libre", async () => {
    const hunt = await createHunt();
    await as(db, viewerB, () => db.query("select public.submit_hunt_call($1, null, 'Wanted')", [hunt]));
    const { rows } = await db.query<{ id: string }>("select id from public.hunt_calls where hunt_id = $1", [hunt]);
    await as(db, mod, () => db.query("select public.reject_hunt_call($1)", [rows[0].id]));
    await expect(
      as(db, viewerB, () => db.query("select public.submit_hunt_call($1, null, 'Wanted Dead')", [hunt])),
    ).rejects.toThrow(/call_rejected/);
    const { rows: after } = await db.query<{ status: string }>("select status from public.hunt_calls where id = $1", [
      rows[0].id,
    ]);
    expect(after[0].status).toBe("rejected");
    // Otro viewer sí puede pedir esa máquina.
    await as(db, viewerA, () => db.query("select public.submit_hunt_call($1, null, 'Wanted')", [hunt]));
  });

  it("una máquina por hunt: no se puede pedir la que ya pidió otro o ya es bono", async () => {
    const hunt = await createHunt();
    await as(db, viewerA, () => db.query("select public.submit_hunt_call($1, null, 'Sweet Bonanza')", [hunt]));
    await expect(
      as(db, viewerB, () => db.query("select public.submit_hunt_call($1, null, '  sweet bonanza ')", [hunt])),
    ).rejects.toThrow(/slot_taken/);

    await as(db, mod, () =>
      db.query("insert into public.hunt_bonuses (hunt_id, slot_name, bet) values ($1, 'Big Bass Bonanza', 100)", [
        hunt,
      ]),
    );
    await expect(
      as(db, viewerB, () => db.query("select public.submit_hunt_call($1, null, 'Big Bass Bonanza')", [hunt])),
    ).rejects.toThrow(/slot_taken/);

    const taken = await as(db, "anon", () =>
      db.query<{ slot_name: string }>("select slot_name from public.hunt_taken_slots($1)", [hunt]),
    );
    expect(taken.rows.map((r) => r.slot_name)).toEqual(["Big Bass Bonanza", "Sweet Bonanza"]);

    // Si el panel rechaza el call, la máquina se libera.
    const { rows } = await db.query<{ id: string }>("select id from public.hunt_calls where hunt_id = $1", [hunt]);
    await as(db, mod, () => db.query("select public.reject_hunt_call($1)", [rows[0].id]));
    await as(db, viewerB, () => db.query("select public.submit_hunt_call($1, null, 'Sweet Bonanza')", [hunt]));
  });

  it("los viewers no escriben calls directo", async () => {
    const hunt = await createHunt();
    await expect(
      as(db, viewerA, () =>
        db.query("insert into public.hunt_calls (hunt_id, user_id, slot_name) values ($1, $2, 'x')", [
          hunt,
          viewerA.id,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("adiviná el balance", () => {
  it("oculta los montos hasta cerrar y elige al más cercano", async () => {
    const hunt = await createHunt();
    await as(db, viewerA, () => db.query("select public.submit_hunt_guess($1, 9000)", [hunt]));
    await as(db, viewerB, () => db.query("select public.submit_hunt_guess($1, 20000)", [hunt]));
    await as(db, viewerB, () => db.query("select public.submit_hunt_guess($1, 12500)", [hunt]));

    const hidden = await as(db, "anon", () =>
      db.query("select id from public.hunt_guesses where hunt_id = $1", [hunt]),
    );
    expect(hidden.rows).toHaveLength(0);
    const count = await as(db, "anon", () =>
      db.query<{ n: number }>("select public.hunt_guess_count($1) as n", [hunt]),
    );
    expect(count.rows[0].n).toBe(2);

    await addBonus(hunt, 100, 7000);
    await addBonus(hunt, 100, 5000);
    await as(db, mod, () => db.query("update public.hunts set status = 'finished' where id = $1", [hunt]));

    const { rows } = await db.query<{
      final_balance: string;
      gtb_winner_id: string;
      calls_open: boolean;
      guesses_open: boolean;
    }>("select final_balance, gtb_winner_id, calls_open, guesses_open from public.hunts where id = $1", [hunt]);
    expect(rows[0]).toEqual({
      final_balance: "12000.00",
      gtb_winner_id: viewerB.id,
      calls_open: false,
      guesses_open: false,
    });

    const visible = await as(db, "anon", () =>
      db.query("select id from public.hunt_guesses where hunt_id = $1", [hunt]),
    );
    expect(visible.rows).toHaveLength(2);

    await expect(as(db, viewerA, () => db.query("select public.submit_hunt_guess($1, 12000)", [hunt]))).rejects.toThrow(
      /guesses_closed/,
    );
    await expect(addBonus(hunt, 100, 1)).rejects.toThrow(/hunt_finished/);
  });

  it("al reabrir se limpian los resultados", async () => {
    const hunt = await createHunt();
    await addBonus(hunt, 100, 300);
    await as(db, mod, () => db.query("update public.hunts set status = 'finished' where id = $1", [hunt]));
    await as(db, mod, () => db.query("update public.hunts set status = 'opening' where id = $1", [hunt]));
    const { rows } = await db.query<{ final_balance: string | null; finished_at: string | null }>(
      "select final_balance, finished_at from public.hunts where id = $1",
      [hunt],
    );
    expect(rows[0]).toEqual({ final_balance: null, finished_at: null });
  });

  it("el admin puede borrar un hunt cerrado con sus bonos", async () => {
    const hunt = await createHunt();
    await addBonus(hunt, 100, 300);
    await as(db, mod, () => db.query("update public.hunts set status = 'finished' where id = $1", [hunt]));
    await db.query("update public.profiles set role = 'admin' where id = $1", [mod.id]);
    try {
      await as(db, mod, () => db.query("delete from public.hunts where id = $1", [hunt]));
    } finally {
      await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
    }
    const { rows } = await db.query("select id from public.hunt_bonuses where hunt_id = $1", [hunt]);
    expect(rows).toHaveLength(0);
  });
});

describe("borrar un bono que vino de un call", () => {
  it("deja al viewer volver a pedir", async () => {
    const hunt = await createHunt();
    await as(db, viewerA, () => db.query("select public.submit_hunt_call($1, null, 'Sugar Rush')", [hunt]));
    const call = await db.query<{ id: string }>("select id from public.hunt_calls where hunt_id = $1", [hunt]);
    const bonus = await as(db, mod, () =>
      db.query<{ id: string }>("select public.accept_hunt_call($1, 100) as id", [call.rows[0].id]),
    );
    await expect(
      as(db, viewerA, () => db.query("select public.submit_hunt_call($1, null, 'Otro')", [hunt])),
    ).rejects.toThrow(/call_already_accepted/);

    await as(db, mod, () => db.query("delete from public.hunt_bonuses where id = $1", [bonus.rows[0].id]));
    await as(db, viewerA, () => db.query("select public.submit_hunt_call($1, null, 'Gates of Olympus')", [hunt]));
    const { rows } = await db.query<{ slot_name: string; status: string }>(
      "select slot_name, status from public.hunt_calls where hunt_id = $1",
      [hunt],
    );
    expect(rows).toEqual([{ slot_name: "Gates of Olympus", status: "pending" }]);
  });
});
