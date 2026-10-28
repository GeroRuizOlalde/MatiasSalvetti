import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { parseSlotReport } = await import("./slot-report");

describe("parseSlotReport", () => {
  it("lee la lista directa con el proveedor como texto", () => {
    expect(
      parseSlotReport([
        {
          name: "Gates of Olympus",
          slug: "gates-of-olympus",
          provider: "Pragmatic Play",
          provider_slug: "pragmatic-play",
        },
        { name: "Wanted Dead or a Wild", provider: "Hacksaw Gaming" },
      ]),
    ).toEqual([
      { name: "Gates of Olympus", provider: "Pragmatic Play" },
      { name: "Wanted Dead or a Wild", provider: "Hacksaw Gaming" },
    ]);
  });

  it("acepta la lista envuelta y el proveedor como objeto", () => {
    expect(parseSlotReport({ slots: [{ name: "Sugar Rush", provider: { name: "Pragmatic Play" } }] })).toEqual([
      { name: "Sugar Rush", provider: "Pragmatic Play" },
    ]);
    expect(parseSlotReport({ data: [{ name: "Book of Dead", provider_name: "Play'n GO" }] })).toEqual([
      { name: "Book of Dead", provider: "Play'n GO" },
    ]);
  });

  it("descarta filas inválidas, vacías y repetidas", () => {
    expect(
      parseSlotReport([
        { name: "  " },
        { title: "sin nombre" },
        { name: "A", provider: "X" },
        { name: "a", provider: "x" },
      ]),
    ).toEqual([{ name: "A", provider: "X" }]);
    expect(parseSlotReport("basura")).toEqual([]);
  });
});
