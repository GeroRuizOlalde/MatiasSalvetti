import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

describe("profiles", () => {
  it("crea el perfil con los datos de Twitch al registrarse", async () => {
    const user = await createTwitchUser(db, "viewer_uno");
    const { rows } = await db.query<{ twitch_login: string; display_name: string; role: string; twitch_id: string }>(
      "select twitch_login, display_name, role, twitch_id from public.profiles where id = $1",
      [user.id],
    );
    expect(rows[0]).toMatchObject({ twitch_login: "viewer_uno", display_name: "VIEWER_UNO", role: "viewer" });
    expect(rows[0].twitch_id).toMatch(/^\d+$/);
  });

  it("anon no lee profiles pero sí la vista pública", async () => {
    await expect(as(db, "anon", () => db.query("select * from public.profiles"))).rejects.toThrow(/permission denied/);
    const { rows } = await as(db, "anon", () => db.query("select * from public.public_profiles"));
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0] as object)).not.toContain("role");
  });

  it("un viewer solo ve su propio perfil y no puede editarlo", async () => {
    const a = await createTwitchUser(db, "viewer_a");
    await createTwitchUser(db, "viewer_b");
    const { rows } = await as(db, a, () => db.query<{ id: string }>("select id from public.profiles"));
    expect(rows.map((r) => r.id)).toEqual([a.id]);
    await expect(
      as(db, a, () => db.query("update public.profiles set role = 'admin' where id = $1", [a.id])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("términos y participación", () => {
  it("can_participate es false hasta aceptar la versión vigente", async () => {
    const user = await createTwitchUser(db, "nuevo");
    const before = await as(db, user, () => db.query<{ ok: boolean }>("select public.can_participate() as ok"));
    expect(before.rows[0].ok).toBe(false);

    await expect(as(db, user, () => db.query("select public.accept_terms(99)"))).rejects.toThrow(
      /terms_version_mismatch/,
    );
    await as(db, user, () => db.query("select public.accept_terms(1)"));

    const after = await as(db, user, () => db.query<{ ok: boolean }>("select public.can_participate() as ok"));
    expect(after.rows[0].ok).toBe(true);
  });

  it("respeta la antigüedad mínima de la cuenta de Twitch", async () => {
    const user = await createTwitchUser(db, "cuenta_nueva");
    await as(db, user, () => db.query("select public.accept_terms(1)"));
    await db.query("update public.site_settings set value = '30' where key = 'twitch_min_account_age_days'");
    await db.query("update public.profiles set twitch_created_at = now() - interval '2 days' where id = $1", [user.id]);
    const res = await as(db, user, () => db.query<{ ok: boolean }>("select public.can_participate() as ok"));
    expect(res.rows[0].ok).toBe(false);
    await db.query("update public.site_settings set value = '0' where key = 'twitch_min_account_age_days'");
  });

  it("un baneado no participa", async () => {
    const user = await createTwitchUser(db, "baneado");
    await as(db, user, () => db.query("select public.accept_terms(1)"));
    await db.query("update public.profiles set banned_at = now() where id = $1", [user.id]);
    const res = await as(db, user, () => db.query<{ ok: boolean }>("select public.can_participate() as ok"));
    expect(res.rows[0].ok).toBe(false);
  });
});

describe("roles", () => {
  it("solo el admin cambia roles, y no el propio", async () => {
    const admin = await createTwitchUser(db, "matias");
    const viewer = await createTwitchUser(db, "futuro_mod");
    await db.query("update public.profiles set role = 'admin' where id = $1", [admin.id]);

    await expect(
      as(db, viewer, () => db.query("select public.set_user_role($1, 'admin')", [viewer.id])),
    ).rejects.toThrow(/forbidden/);
    await expect(
      as(db, admin, () => db.query("select public.set_user_role($1, 'viewer')", [admin.id])),
    ).rejects.toThrow(/cannot_change_own_role/);

    await as(db, admin, () => db.query("select public.set_user_role($1, 'mod')", [viewer.id]));
    const { rows } = await db.query<{ role: string }>("select role from public.profiles where id = $1", [viewer.id]);
    expect(rows[0].role).toBe("mod");

    const mine = await as(db, viewer, () => db.query<{ ok: boolean }>("select public.is_mod() as ok"));
    expect(mine.rows[0].ok).toBe(true);
  });

  it("un mod baneado pierde el acceso al panel", async () => {
    const mod = await createTwitchUser(db, "mod_baneado");
    await db.query("update public.profiles set role = 'mod', banned_at = now() where id = $1", [mod.id]);
    const res = await as(db, mod, () => db.query<{ ok: boolean }>("select public.is_mod() as ok"));
    expect(res.rows[0].ok).toBe(false);
  });
});

describe("configuración y catálogo", () => {
  it("el token de overlays no es público", async () => {
    const { rows } = await as(db, "anon", () => db.query<{ key: string }>("select key from public.site_settings"));
    const keys = rows.map((r) => r.key);
    expect(keys).toContain("socials");
    expect(keys).not.toContain("overlay_token");
  });

  it("anon lee casinos activos y no puede escribir", async () => {
    const { rows } = await as(db, "anon", () =>
      db.query<{ slug: string }>("select slug from public.casinos order by sort_order"),
    );
    // Win Win está desactivado (20261109000001_sin_win_win.sql).
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.slug)).not.toContain("win-win");
    await expect(
      as(db, "anon", () =>
        db.query("insert into public.casinos (name, slug, referral_url) values ('X', 'x', 'https://x.test')"),
      ),
    ).rejects.toThrow();
  });

  it("los mods crean slots y el buscador los encuentra", async () => {
    const mod = await createTwitchUser(db, "mod_slots");
    const viewer = await createTwitchUser(db, "viewer_slots");
    await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);

    await expect(
      as(db, viewer, () => db.query("insert into public.slots (name, provider) values ('Slot Test', 'Proveedor')")),
    ).rejects.toThrow(/row-level security/);

    await as(db, mod, () =>
      db.query("insert into public.slots (name, provider) values ('Slot Test', 'Proveedor'), ('Otro Slot', null)"),
    );
    const { rows } = await as(db, "anon", () =>
      db.query<{ name: string }>("select name from public.search_slots('slot t')"),
    );
    expect(rows[0].name).toBe("Slot Test");
  });
});

describe("rate limit", () => {
  it("corta después del límite dentro de la ventana", async () => {
    const user = await createTwitchUser(db, "spammer");
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { rows } = await as(db, user, () =>
        db.query<{ ok: boolean }>("select public.hit_rate_limit('test', 3, 60) as ok"),
      );
      results.push(rows[0].ok);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});

describe("storage", () => {
  it("cada viewer sube capturas solo en su carpeta", async () => {
    const user = await createTwitchUser(db, "verificador");
    await as(db, user, () =>
      db.query("insert into storage.objects (bucket_id, name) values ('verifications', $1)", [`${user.id}/a.png`]),
    );
    await expect(
      as(db, user, () =>
        db.query("insert into storage.objects (bucket_id, name) values ('verifications', 'otro-usuario/a.png')"),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
