import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, type TestDb } from "./harness";

let db: TestDb;
let token: string;

beforeAll(async () => {
  db = await createTestDb();
  const { rows } = await db.query<{ token: string }>(
    "select value #>> '{}' as token from public.site_settings where key = 'overlay_token'",
  );
  token = rows[0].token;
}, 60_000);

describe("check_overlay_token", () => {
  it("acepta el token vigente y nada más", async () => {
    const check = (key: string | null) =>
      as(db, "anon", () => db.query<{ ok: boolean }>("select public.check_overlay_token($1) as ok", [key])).then(
        (r) => r.rows[0].ok,
      );
    expect(await check(token)).toBe(true);
    expect(await check("otro-token-cualquiera")).toBe(false);
    expect(await check("")).toBe(false);
    expect(await check(null)).toBe(false);
  });

  it("anon no puede leer el token", async () => {
    const { rows } = await as(db, "anon", () =>
      db.query("select value from public.site_settings where key = 'overlay_token'"),
    );
    expect(rows).toHaveLength(0);
  });
});
