import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, type TestDb } from "./harness";

let db: TestDb;

const search = (query: string, limit = 10) =>
  as(db, "anon", () => db.query<{ name: string }>("select name from public.search_slots($1, $2)", [query, limit])).then(
    (r) => r.rows.map((row) => row.name),
  );

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`
    insert into public.slots (name, provider) values
      ('Sweet Bonanza', 'Pragmatic Play'),
      ('Sweet Bonanza 1000', 'Pragmatic Play'),
      ('Sweet Bonanza Xmas', 'Pragmatic Play'),
      ('Sweet Rush Bonanza', 'Pragmatic Play'),
      ('Gates of Olympus', 'Pragmatic Play'),
      ('Bonanza Gold', 'Pragmatic Play'),
      ('Wanted Dead or a Wild', 'Hacksaw Gaming'),
      ('100% Fruits', 'Proveedor X')
  `);
  await db.query("insert into public.slots (name, provider, is_active) values ('Sweet Bonanza Viejo', null, false)");
}, 60_000);

describe("search_slots", () => {
  it("encuentra todas las que tienen las palabras, con el exacto primero", async () => {
    const results = await search("sweet bonanza");
    expect(results[0]).toBe("Sweet Bonanza");
    expect(results).toEqual(expect.arrayContaining(["Sweet Bonanza 1000", "Sweet Bonanza Xmas", "Sweet Rush Bonanza"]));
    expect(results).not.toContain("Bonanza Gold");
    expect(results).not.toContain("Sweet Bonanza Viejo");
  });

  it("las palabras pueden ir en cualquier orden o ser parciales", async () => {
    expect(await search("bonanza sweet")).toContain("Sweet Bonanza");
    expect(await search("swe 1000")).toEqual(["Sweet Bonanza 1000"]);
  });

  it("busca también por proveedor", async () => {
    expect(await search("wanted hacksaw")).toEqual(["Wanted Dead or a Wild"]);
  });

  it("tolera errores de tipeo", async () => {
    expect(await search("gates of olimpus")).toContain("Gates of Olympus");
  });

  it("los comodines se buscan literal y respeta el límite", async () => {
    expect(await search("100%")).toEqual(["100% Fruits"]);
    expect(await search("_")).toEqual([]);
    expect(await search("bonanza", 2)).toHaveLength(2);
    expect(await search("   ")).toEqual([]);
  });
});
