import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let mod: { id: string };
let viewer: { id: string };

beforeAll(async () => {
  db = await createTestDb();
  mod = await createTwitchUser(db, "mod_import");
  viewer = await createTwitchUser(db, "viewer_import");
  await db.query("update public.profiles set role = 'mod' where id = $1", [mod.id]);
}, 60_000);

describe("import_slots", () => {
  it("inserta, ignora duplicados (sin importar mayúsculas) y filas vacías", async () => {
    const rows = [
      { name: "Slot Uno", provider: "Proveedor A" },
      { name: "slot uno", provider: "proveedor a" },
      { name: "Slot Dos", provider: "" },
      { name: "   ", provider: "X" },
    ];
    const first = await as(db, mod, () =>
      db.query<{ n: number }>("select public.import_slots($1) as n", [JSON.stringify(rows)]),
    );
    expect(first.rows[0].n).toBe(2);

    const again = await as(db, mod, () =>
      db.query<{ n: number }>("select public.import_slots($1) as n", [JSON.stringify(rows)]),
    );
    expect(again.rows[0].n).toBe(0);

    const { rows: slots } = await db.query<{ provider: string | null }>(
      "select provider from public.slots where lower(name) = 'slot dos'",
    );
    expect(slots[0].provider).toBeNull();
  });

  it("un viewer no puede importar", async () => {
    await expect(
      as(db, viewer, () => db.query("select public.import_slots($1)", [JSON.stringify([{ name: "X" }])])),
    ).rejects.toThrow(/forbidden/);
  });
});
