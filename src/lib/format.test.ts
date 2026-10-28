import { describe, expect, it } from "vitest";
import { formatDateTime, formatMoney, formatMulti, maskAccountId } from "./format";

const NBSP = " ";

describe("formatMoney", () => {
  it("formatea ARS sin decimales cuando el monto es entero", () => {
    expect(formatMoney(1_000_000)).toBe(`$${NBSP}1.000.000`);
    expect(formatMoney(1_000)).toBe(`$${NBSP}1.000`);
    expect(formatMoney(0)).toBe(`$${NBSP}0`);
  });

  it("muestra dos decimales cuando hacen falta", () => {
    expect(formatMoney(150.5)).toBe(`$${NBSP}150,50`);
    expect(formatMoney(0.1 + 0.2)).toBe(`$${NBSP}0,30`);
  });

  it("formatea negativos y USD", () => {
    expect(formatMoney(-2500)).toBe(`-$${NBSP}2.500`);
    expect(formatMoney(20, "USD")).toBe(`US$${NBSP}20`);
  });
});

describe("formatMulti", () => {
  it("usa dos decimales y sufijo x", () => {
    expect(formatMulti(100)).toBe("100,00x");
    expect(formatMulti(1234.567)).toBe("1.234,57x");
    expect(formatMulti(0)).toBe("0,00x");
  });
});

describe("formatDateTime", () => {
  it("usa la hora de Buenos Aires", () => {
    // 00:30 UTC del 28/10 = 21:30 del 27/10 en Argentina (UTC-3)
    expect(formatDateTime("2026-10-28T00:30:00Z")).toMatch(/27\/10 · 21:30$/);
  });
});

describe("maskAccountId", () => {
  it("enmascara IDs largos dejando 4 y 3 dígitos", () => {
    expect(maskAccountId("1239456623")).toBe("1239•••623");
  });

  it("muestra menos dígitos en IDs cortos", () => {
    expect(maskAccountId("123456")).toBe("12•••56");
    expect(maskAccountId("1234")).toBe("•••");
  });
});
