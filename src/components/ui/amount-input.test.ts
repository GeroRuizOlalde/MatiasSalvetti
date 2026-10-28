import { describe, expect, it } from "vitest";
import { formatAmountInput, parseAmountInput } from "./amount-input";

describe("campo de monto", () => {
  it("pone los puntos de miles mientras se escribe", () => {
    expect(parseAmountInput("1000", true, false)).toEqual({ raw: "1000", display: "1.000" });
    expect(parseAmountInput("1.0000", true, false)).toEqual({ raw: "10000", display: "10.000" });
    expect(parseAmountInput("1234567", true, false)).toEqual({ raw: "1234567", display: "1.234.567" });
  });

  it("usa la coma para los centavos (hasta dos)", () => {
    expect(parseAmountInput("1.500,", true, false)).toEqual({ raw: "1500.", display: "1.500," });
    expect(parseAmountInput("1.500,509", true, false)).toEqual({ raw: "1500.50", display: "1.500,50" });
    expect(parseAmountInput(",5", true, false)).toEqual({ raw: "0.5", display: "0,5" });
    expect(parseAmountInput("1500,5", false, false)).toEqual({ raw: "15005", display: "15.005" });
  });

  it("borra todo y respeta el negativo solo si se permite", () => {
    expect(parseAmountInput("", true, false)).toEqual({ raw: "", display: "" });
    expect(parseAmountInput("-1000", false, true)).toEqual({ raw: "-1000", display: "-1.000" });
    expect(parseAmountInput("-1000", false, false)).toEqual({ raw: "1000", display: "1.000" });
    expect(parseAmountInput("007", true, false)).toEqual({ raw: "7", display: "7" });
  });

  it("formatea el valor inicial", () => {
    expect(formatAmountInput("1500.5")).toBe("1.500,5");
    expect(formatAmountInput("160000")).toBe("160.000");
    expect(formatAmountInput("-2500")).toBe("-2.500");
    expect(formatAmountInput("")).toBe("");
  });
});
