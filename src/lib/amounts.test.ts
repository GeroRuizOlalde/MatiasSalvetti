import { describe, expect, it } from "vitest";
import { parseAmount, parseAmountList } from "./amounts";

describe("parseAmount", () => {
  it.each([
    ["1500", 1500],
    ["1.500", 1500],
    ["1,500,000", 1500000],
    ["1,234.56", 1234.56],
    ["1.234,56", 1234.56],
    ["10.5", 10.5],
    ["10,50", 10.5],
    ["$ 2.000", 2000],
    ["US$ 10,5", 10.5],
    ["1234.567", 1234.567],
  ])("%s → %d", (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it("null si no hay número", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("1-2")).toBeNull();
  });
});

describe("parseAmountList", () => {
  it("separa por renglón, punto y coma o barra", () => {
    expect(parseAmountList("1.000\n500; 250 / 100")).toEqual([1000, 500, 250, 100]);
    expect(parseAmountList("")).toEqual([]);
    expect(parseAmountList("1000\nhola")).toBeNull();
  });
});
