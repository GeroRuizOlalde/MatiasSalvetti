import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let admin: { id: string };
let viewer: { id: string };
let other: { id: string };
let fresh: { id: string };

const profile = async (user: { id: string }) =>
  (
    await db.query<{
      points: number;
      xp: number;
      points_earned: number;
      daily_streak: number;
    }>("select points, xp, points_earned, daily_streak from public.profiles where id = $1", [user.id])
  ).rows[0];

const claim = (user: { id: string }) =>
  as(db, user, () => db.query<{ points: number; streak: number }>("select * from public.claim_daily_bonus()")).then(
    (r) => r.rows[0],
  );

/** Corre los reclamos N días para atrás, como si hubiera pasado el tiempo. */
const daysPass = async (user: { id: string }, days: number) => {
  await db.query("update public.profiles set daily_last_claim = daily_last_claim - $2::integer where id = $1", [
    user.id,
    days,
  ]);
  await db.query(
    "update public.point_events set source_ref = to_char(source_ref::date - $2::integer, 'YYYY-MM-DD') where user_id = $1 and kind = 'daily_bonus'",
    [user.id, days],
  );
};

beforeAll(async () => {
  db = await createTestDb();
  admin = await createTwitchUser(db, "admin_puntos");
  viewer = await createTwitchUser(db, "viewer_puntos");
  other = await createTwitchUser(db, "otro_puntos");
  fresh = await createTwitchUser(db, "nuevo_puntos", { fresh: true });
  await db.query("update public.profiles set role = 'admin' where id = $1", [admin.id]);
  for (const user of [viewer, other, fresh]) {
    await as(db, user, () => db.query("select public.accept_terms(1)"));
  }
}, 60_000);

describe("bonus diario", () => {
  it("paga una vez por día y la racha suma 10% por día, con tope de +100%", async () => {
    expect(await claim(viewer)).toEqual({ points: 50, streak: 1 });
    await expect(claim(viewer)).rejects.toThrow(/already_claimed/);
    expect(await profile(viewer)).toMatchObject({
      points: 50,
      xp: 50,
      points_earned: 50,
      daily_streak: 1,
    });

    await daysPass(viewer, 1);
    expect(await claim(viewer)).toEqual({ points: 55, streak: 2 });

    // Día 11 en adelante: tope de +100%.
    await db.query("update public.profiles set daily_streak = 10 where id = $1", [viewer.id]);
    await daysPass(viewer, 1);
    expect(await claim(viewer)).toEqual({ points: 100, streak: 11 });
    await daysPass(viewer, 1);
    expect(await claim(viewer)).toEqual({ points: 100, streak: 12 });
  });

  it("si se saltea un día, la racha vuelve a empezar", async () => {
    await daysPass(viewer, 2);
    expect(await claim(viewer)).toEqual({ points: 50, streak: 1 });
  });

  it("usa los valores que configura el admin", async () => {
    await db.query(
      "update public.site_settings set value = value || '{\"daily_points\": 80}'::jsonb where key = 'points_config'",
    );
    expect(await claim(other)).toEqual({ points: 80, streak: 1 });
    await db.query(
      "update public.site_settings set value = value || '{\"daily_points\": 50}'::jsonb where key = 'points_config'",
    );
  });

  it("no se puede sin sesión ni escribiendo puntos a mano", async () => {
    await expect(as(db, "anon", () => db.query("select * from public.claim_daily_bonus()"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      as(db, viewer, () => db.query("update public.profiles set points = 999999 where id = $1", [viewer.id])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, viewer, () =>
        db.query("insert into public.point_events (user_id, kind, points) values ($1, 'mission', 999)", [viewer.id]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, viewer, () => db.query("select public.apply_points($1, 'mission', null, 999, 0)", [viewer.id])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("bloqueo de puntos", () => {
  it("el bloqueado no suma ni canjea; el ajuste del admin queda en el libro con quién lo hizo", async () => {
    await expect(
      as(db, viewer, () => db.query("select public.set_points_block($1, true, 'x')", [other.id])),
    ).rejects.toThrow(/forbidden/);
    await as(db, admin, () => db.query("select public.set_points_block($1, true, 'Multicuenta')", [other.id]));

    await daysPass(other, 1);
    await expect(claim(other)).rejects.toThrow(/points_blocked/);

    await as(db, admin, () => db.query("select public.admin_adjust_points($1, 500, 0, 'Corrección')", [other.id]));
    const { rows } = await db.query(
      "select points, note, created_by from public.point_events where user_id = $1 and kind = 'admin_adjust'",
      [other.id],
    );
    expect(rows).toEqual([{ points: 500, note: "Corrección", created_by: admin.id }]);

    const { rows: item } = await as(db, admin, () =>
      db.query<{ id: string }>("insert into public.shop_items (title, cost) values ('Shoutout', 100) returning id"),
    );
    await expect(as(db, other, () => db.query("select public.buy_shop_item($1)", [item[0].id]))).rejects.toThrow(
      /points_blocked/,
    );

    await as(db, admin, () => db.query("select public.set_points_block($1, false)", [other.id]));
    await as(db, other, () => db.query("select public.buy_shop_item($1)", [item[0].id]));
  });
});

describe("cuentas nuevas", () => {
  it("acumulan puntos pero no canjean hasta cumplir la antigüedad", async () => {
    expect(await claim(fresh)).toEqual({ points: 50, streak: 1 });
    await as(db, admin, () => db.query("select public.admin_adjust_points($1, 1000, 0, 'test')", [fresh.id]));
    const { rows: item } = await as(db, admin, () =>
      db.query<{ id: string }>("insert into public.shop_items (title, cost) values ('Merch', 100) returning id"),
    );
    await expect(as(db, fresh, () => db.query("select public.buy_shop_item($1)", [item[0].id]))).rejects.toThrow(
      /account_too_new/,
    );
    expect((await profile(fresh)).points).toBe(1050);

    await db.query("update public.profiles set twitch_created_at = now() - interval '8 days' where id = $1", [
      fresh.id,
    ]);
    await as(db, fresh, () => db.query("select public.buy_shop_item($1)", [item[0].id]));
    expect((await profile(fresh)).points).toBe(950);
  });
});

describe("ranking de puntos", () => {
  it("histórico y semanal: solo lo ganado, sin reintegros, sin bloqueados", async () => {
    const all = await as(db, "anon", () =>
      db.query<{ twitch_login: string; points: number }>(
        "select twitch_login, points from public.points_leaderboard('all', 10)",
      ),
    );
    // fresh: 50 + 1000. other: 80 + 500. viewer: 50 + 55 + 100 + 100 + 50.
    expect(all.rows).toEqual([
      { twitch_login: "nuevo_puntos", points: 1050 },
      { twitch_login: "otro_puntos", points: 580 },
      { twitch_login: "viewer_puntos", points: 355 },
    ]);

    // Lo de la semana pasada no cuenta en el semanal.
    await db.query(
      "update public.point_events set created_at = now() - interval '8 days' where user_id = $1 and kind = 'admin_adjust'",
      [fresh.id],
    );
    await as(db, admin, () => db.query("select public.set_points_block($1, true)", [other.id]));
    const week = await as(db, "anon", () =>
      db.query<{ twitch_login: string; points: number }>(
        "select twitch_login, points from public.points_leaderboard('week', 10)",
      ),
    );
    expect(week.rows).toEqual([
      { twitch_login: "viewer_puntos", points: 355 },
      { twitch_login: "nuevo_puntos", points: 50 },
    ]);
  });
});
