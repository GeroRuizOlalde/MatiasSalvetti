import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let admin: { id: string };
let viewerA: { id: string };
let viewerB: { id: string };
let newbie: { id: string };

const balance = async (user: { id: string }) =>
  (
    await db.query<{ points: number; xp: number; level: number; tickets: number }>(
      "select points, xp, level, tickets from public.profiles where id = $1",
      [user.id],
    )
  ).rows[0];

const adjust = (user: { id: string }, points: number, xp = 0) =>
  as(db, admin, () => db.query("select public.admin_adjust_points($1, $2, $3, 'test')", [user.id, points, xp]));

beforeAll(async () => {
  db = await createTestDb();
  admin = await createTwitchUser(db, "admin_cuartel");
  viewerA = await createTwitchUser(db, "viewer_cuartel_a");
  viewerB = await createTwitchUser(db, "viewer_cuartel_b");
  newbie = await createTwitchUser(db, "viewer_cuartel_nuevo");
  await db.query("update public.profiles set role = 'admin' where id = $1", [admin.id]);
  for (const user of [viewerA, viewerB]) {
    await as(db, user, () => db.query("select public.accept_terms(1)"));
  }
}, 60_000);

describe("niveles", () => {
  it("level_for_xp sigue la curva por defecto (300, 666, 1.061…)", async () => {
    const { rows } = await db.query<{ a: number; b: number; c: number; d: number }>(
      "select public.level_for_xp(0) a, public.level_for_xp(299) b, public.level_for_xp(300) c, public.level_for_xp(966) d",
    );
    expect(rows[0]).toEqual({ a: 1, b: 1, c: 2, d: 3 });
  });
});

describe("puntos", () => {
  it("solo el admin ajusta, con motivo, y nunca quedan negativos", async () => {
    await expect(
      as(db, viewerA, () => db.query("select public.admin_adjust_points($1, 100, 0, 'x')", [viewerA.id])),
    ).rejects.toThrow(/forbidden/);
    await adjust(viewerA, 1000, 300);
    expect(await balance(viewerA)).toMatchObject({ points: 1000, xp: 300, level: 2 });
    await adjust(viewerB, -50);
    expect((await balance(viewerB)).points).toBe(0);
  });

  it("los viewers ven solo su historial y no lo pueden escribir", async () => {
    const own = await as(db, viewerA, () => db.query("select kind from public.point_events"));
    expect(own.rows).toEqual([{ kind: "admin_adjust" }]);
    await expect(
      as(db, viewerA, () =>
        db.query("insert into public.point_events (user_id, kind, points) values ($1, 'hack', 999)", [viewerA.id]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, viewerA, () => db.query("select public.apply_points($1, 'hack', null, 999, 0)", [viewerA.id])),
    ).rejects.toThrow(/permission denied/);
  });

  it("premia el call aceptado una sola vez", async () => {
    const { rows } = await as(db, admin, () =>
      db.query<{ id: string }>(
        "insert into public.hunts (title, start_cost, status, calls_open) values ('H', 1, 'collecting', true) returning id",
      ),
    );
    await as(db, viewerB, () => db.query("select public.submit_hunt_call($1, null, 'Slot')", [rows[0].id]));
    const { rows: call } = await db.query<{ id: string }>("select id from public.hunt_calls where hunt_id = $1", [
      rows[0].id,
    ]);
    await as(db, admin, () => db.query("select public.accept_hunt_call($1, 10)", [call[0].id]));
    expect(await balance(viewerB)).toMatchObject({ points: 50, xp: 40 });
  });

  it("al terminar el hunt premia a los que apostaron y más al ganador", async () => {
    const { rows } = await as(db, admin, () =>
      db.query<{ id: string }>(
        "insert into public.hunts (title, start_cost, status, guesses_open) values ('H2', 1, 'opening', true) returning id",
      ),
    );
    const hunt = rows[0].id;
    await as(db, viewerA, () => db.query("select public.submit_hunt_guess($1, 100)", [hunt]));
    await as(db, viewerB, () => db.query("select public.submit_hunt_guess($1, 5000)", [hunt]));
    await as(db, admin, () =>
      db.query("insert into public.hunt_bonuses (hunt_id, slot_name, bet, payout) values ($1, 'x', 1, 90)", [hunt]),
    );
    const before = { a: await balance(viewerA), b: await balance(viewerB) };
    await as(db, admin, () => db.query("update public.hunts set status = 'finished' where id = $1", [hunt]));
    const after = { a: await balance(viewerA), b: await balance(viewerB) };
    expect(after.a.points - before.a.points).toBe(10 + 300);
    expect(after.b.points - before.b.points).toBe(10);

    // Reabrir y volver a cerrar no paga de nuevo.
    await as(db, admin, () => db.query("update public.hunts set status = 'opening' where id = $1", [hunt]));
    await as(db, admin, () => db.query("update public.hunts set status = 'finished' where id = $1", [hunt]));
    expect((await balance(viewerA)).points).toBe(after.a.points);
  });
});

describe("premios de buys y battles", () => {
  it("votar suma al cerrar la votación y bancar al campeón suma extra", async () => {
    const { rows: session } = await as(db, admin, () =>
      db.query<{ id: string }>("insert into public.buy_sessions (title, status) values ('B', 'live') returning id"),
    );
    await as(db, admin, () =>
      db.query("select public.open_buy_poll($1, $2)", [
        session[0].id,
        JSON.stringify([{ slot_name: "A" }, { slot_name: "B" }]),
      ]),
    );
    const { rows: options } = await db.query<{ id: string }>(
      "select o.id from public.buy_poll_options o join public.buy_polls p on p.id = o.poll_id where p.session_id = $1",
      [session[0].id],
    );
    const before = (await balance(viewerB)).points;
    await as(db, viewerB, () => db.query("select public.cast_buy_vote($1)", [options[0].id]));
    await as(db, admin, () => db.query("select public.close_buy_poll($1)", [session[0].id]));
    expect((await balance(viewerB)).points).toBe(before + 5);

    const { rows: battle } = await as(db, admin, () =>
      db.query<{ id: string }>("insert into public.battles (title, status) values ('Bt', 'open') returning id"),
    );
    await as(db, admin, () =>
      db.query("insert into public.battle_entries (battle_id, slot_name) values ($1, 'X'), ($1, 'Y')", [battle[0].id]),
    );
    const { rows: entries } = await db.query<{ id: string }>(
      "select id from public.battle_entries where battle_id = $1 order by seed",
      [battle[0].id],
    );
    await as(db, viewerA, () => db.query("select public.pick_battle_entry($1)", [entries[0].id]));
    await as(db, viewerB, () => db.query("select public.pick_battle_entry($1)", [entries[1].id]));
    await as(db, admin, () => db.query("select public.start_battle($1)", [battle[0].id]));
    const a = (await balance(viewerA)).points;
    const b = (await balance(viewerB)).points;
    await as(db, admin, () =>
      db.query(
        "update public.battle_matches set bet_a = 1, payout_a = 100, bet_b = 1, payout_b = 10 where battle_id = $1",
        [battle[0].id],
      ),
    );
    expect((await balance(viewerA)).points - a).toBe(10 + 150);
    expect((await balance(viewerB)).points - b).toBe(10);
  });
});

describe("misiones", () => {
  it("diaria: una vez por día; con código: hay que acertar", async () => {
    const { rows } = await as(db, admin, () =>
      db.query<{ id: string; type: string }>(
        "insert into public.missions (title, type, points, xp) values ('Check-in', 'daily', 20, 10), ('Palabra', 'code', 100, 50) returning id, type",
      ),
    );
    const daily = rows.find((r) => r.type === "daily")!.id;
    const code = rows.find((r) => r.type === "code")!.id;
    await as(db, admin, () =>
      db.query("insert into public.mission_codes (mission_id, code) values ($1, 'Chupetti')", [code]),
    );

    const start = (await balance(viewerB)).points;
    await as(db, viewerB, () => db.query("select public.claim_mission($1)", [daily]));
    await expect(as(db, viewerB, () => db.query("select public.claim_mission($1)", [daily]))).rejects.toThrow(
      /already_claimed/,
    );
    await expect(as(db, viewerB, () => db.query("select public.claim_mission($1, 'otra')", [code]))).rejects.toThrow(
      /wrong_code/,
    );
    await as(db, viewerB, () => db.query("select public.claim_mission($1, '  chupetti ')", [code]));
    expect((await balance(viewerB)).points).toBe(start + 120);

    await expect(as(db, newbie, () => db.query("select public.claim_mission($1)", [daily]))).rejects.toThrow(
      /cannot_participate/,
    );
    const codes = await as(db, viewerB, () => db.query("select * from public.mission_codes"));
    expect(codes.rows).toHaveLength(0);
  });
});

describe("tienda", () => {
  it("canjea, respeta stock y límite, y el admin puede cancelar con reintegro", async () => {
    const { rows } = await as(db, admin, () =>
      db.query<{ id: string; kind: string }>(
        `insert into public.shop_items (title, kind, tickets, cost, stock, per_user_limit)
         values ('Remera', 'reward', null, 300, 1, null), ('Pack tickets', 'tickets', 3, 100, null, 2)
         returning id, kind`,
      ),
    );
    const shirt = rows.find((r) => r.kind === "reward")!.id;
    const pack = rows.find((r) => r.kind === "tickets")!.id;
    await adjust(viewerA, 1000);
    const start = await balance(viewerA);

    const { rows: order } = await as(db, viewerA, () =>
      db.query<{ id: string }>("select public.buy_shop_item($1) as id", [shirt]),
    );
    await expect(as(db, viewerA, () => db.query("select public.buy_shop_item($1)", [shirt]))).rejects.toThrow(
      /out_of_stock/,
    );
    await as(db, viewerA, () => db.query("select public.buy_shop_item($1)", [pack]));
    await as(db, viewerA, () => db.query("select public.buy_shop_item($1)", [pack]));
    await expect(as(db, viewerA, () => db.query("select public.buy_shop_item($1)", [pack]))).rejects.toThrow(
      /limit_reached/,
    );
    expect(await balance(viewerA)).toMatchObject({ points: start.points - 500, tickets: start.tickets + 6 });

    await as(db, admin, () => db.query("select public.handle_shop_order($1, false, 'sin talle')", [order[0].id]));
    expect((await balance(viewerA)).points).toBe(start.points - 200);
    const { rows: item } = await db.query<{ stock: number }>("select stock from public.shop_items where id = $1", [
      shirt,
    ]);
    expect(item[0].stock).toBe(1);
  });

  it("no alcanza", async () => {
    const { rows } = await as(db, admin, () =>
      db.query<{ id: string }>("insert into public.shop_items (title, cost) values ('Caro', 999999) returning id"),
    );
    await expect(as(db, viewerB, () => db.query("select public.buy_shop_item($1)", [rows[0].id]))).rejects.toThrow(
      /not_enough_points/,
    );
  });
});

describe("sorteos", () => {
  async function createGiveaway(values: string) {
    const { rows } = await as(db, admin, () =>
      db.query<{ id: string }>(
        `insert into public.giveaways (title, prize, ends_at, status, entry_mode, max_tickets_per_user, winners_count, min_level)
         values ${values} returning id`,
      ),
    );
    return rows[0].id;
  }

  it("gratis: una participación; con requisitos de nivel", async () => {
    const free = await createGiveaway("('Gratis', 'Premio', now() + interval '1 day', 'published', 'free', 1, 1, 1)");
    await as(db, viewerB, () => db.query("select public.enter_giveaway($1)", [free]));
    await expect(as(db, viewerB, () => db.query("select public.enter_giveaway($1)", [free]))).rejects.toThrow(
      /already_entered/,
    );
    const highLevel = await createGiveaway(
      "('Nivel', 'Premio', now() + interval '1 day', 'published', 'free', 1, 1, 50)",
    );
    await expect(as(db, viewerB, () => db.query("select public.enter_giveaway($1)", [highLevel]))).rejects.toThrow(
      /level_too_low/,
    );
  });

  it("con tickets: descuenta tickets y respeta el máximo", async () => {
    const tickets = await createGiveaway(
      "('Tickets', 'Premio', now() + interval '1 day', 'published', 'tickets', 4, 1, 1)",
    );
    const start = (await balance(viewerA)).tickets;
    const { rows } = await as(db, viewerA, () =>
      db.query<{ n: number }>("select public.enter_giveaway($1, 3) as n", [tickets]),
    );
    expect(rows[0].n).toBe(3);
    await as(db, viewerA, () => db.query("select public.enter_giveaway($1, 5)", [tickets]));
    expect((await balance(viewerA)).tickets).toBe(start - 4);
    await expect(as(db, viewerA, () => db.query("select public.enter_giveaway($1)", [tickets]))).rejects.toThrow(
      /max_tickets_reached/,
    );
  });

  it("sortea sin repetir, permite anular y re-sortear, y publica los ganadores", async () => {
    const g = await createGiveaway("('Draw', 'Premio', now() + interval '1 day', 'published', 'free', 1, 1, 1)");
    await as(db, viewerA, () => db.query("select public.enter_giveaway($1)", [g]));
    await as(db, viewerB, () => db.query("select public.enter_giveaway($1)", [g]));

    await expect(as(db, viewerA, () => db.query("select public.draw_giveaway($1)", [g]))).rejects.toThrow(/forbidden/);
    await as(db, admin, () => db.query("select public.draw_giveaway($1)", [g]));
    await expect(as(db, admin, () => db.query("select public.draw_giveaway($1)", [g]))).rejects.toThrow(
      /nothing_to_draw/,
    );

    const { rows: first } = await as(db, "anon", () =>
      db.query<{ user_id: string }>("select user_id from public.giveaway_winners where giveaway_id = $1", [g]),
    );
    expect(first).toHaveLength(1);
    await as(db, admin, () => db.query("select public.set_winner_status($1, $2, 'void')", [g, first[0].user_id]));
    await as(db, admin, () => db.query("select public.draw_giveaway($1)", [g]));

    const { rows: winners } = await as(db, "anon", () =>
      db.query<{ user_id: string; position: number }>(
        "select user_id, position from public.giveaway_winners where giveaway_id = $1",
        [g],
      ),
    );
    expect(winners).toHaveLength(1);
    expect(winners[0].user_id).not.toBe(first[0].user_id);
    expect(winners[0].position).toBe(2);

    const stats = await as(db, "anon", () =>
      db.query<{ participants: number; entries: number }>("select * from public.giveaway_stats($1)", [g]),
    );
    expect(stats.rows[0]).toEqual({ participants: 2, entries: 2 });
  });

  it("cerrado no acepta participaciones", async () => {
    const { rows } = await as(db, admin, () =>
      db.query<{ id: string }>(
        `insert into public.giveaways (title, prize, starts_at, ends_at, status)
         values ('Viejo', 'P', now() - interval '2 days', now() - interval '1 day', 'published') returning id`,
      ),
    );
    await expect(as(db, viewerA, () => db.query("select public.enter_giveaway($1)", [rows[0].id]))).rejects.toThrow(
      /giveaway_closed/,
    );
  });
});
