import { describe, expect, it } from "vitest";
import { bonusMulti, huntStats, rankGuesses } from "./hunt";

describe("huntStats", () => {
  it("sin bonos", () => {
    const stats = huntStats(10000, []);
    expect(stats).toMatchObject({
      bonuses: 0,
      opened: 0,
      averageMulti: null,
      requiredMulti: null,
      breakEvenMulti: null,
    });
    expect(stats.profit).toBe(-10000);
  });

  it("antes de abrir: el multi necesario es el de empate", () => {
    const stats = huntStats(10000, [
      { bet: 100, payout: null },
      { bet: 400, payout: null },
    ]);
    expect(stats.breakEvenMulti).toBe(20);
    expect(stats.requiredMulti).toBe(20);
    expect(stats.best).toBeNull();
  });

  it("a mitad de apertura", () => {
    const stats = huntStats(10000, [
      { bet: 100, payout: 6000 },
      { bet: 100, payout: 0 },
      { bet: 200, payout: null },
    ]);
    expect(stats.opened).toBe(2);
    expect(stats.won).toBe(6000);
    expect(stats.averageMulti).toBe(30);
    expect(stats.remainingBet).toBe(200);
    expect(stats.requiredMulti).toBe(20);
    expect(stats.best).toEqual({ index: 0, multi: 60 });
  });

  it("si ya se recuperó, el multi necesario es 0", () => {
    const stats = huntStats(1000, [
      { bet: 10, payout: 5000 },
      { bet: 10, payout: null },
    ]);
    expect(stats.requiredMulti).toBe(0);
    expect(stats.profit).toBe(4000);
  });

  it("redondea montos con decimales", () => {
    expect(
      huntStats(0.3, [
        { bet: 0.1, payout: 0.2 },
        { bet: 0.2, payout: null },
      ]).totalBet,
    ).toBe(0.3);
  });
});

describe("bonusMulti", () => {
  it("null si no se abrió", () => {
    expect(bonusMulti({ bet: 100, payout: null })).toBeNull();
    expect(bonusMulti({ bet: 100, payout: 250 })).toBe(2.5);
  });
});

describe("rankGuesses", () => {
  it("ordena por cercanía y desempata por fecha", () => {
    const ranked = rankGuesses(
      [
        { userId: "a", amount: 900, updatedAt: "2026-10-28T10:00:00Z" },
        { userId: "b", amount: 1100, updatedAt: "2026-10-28T09:00:00Z" },
        { userId: "c", amount: 2000, updatedAt: "2026-10-28T08:00:00Z" },
      ],
      1000,
    );
    expect(ranked.map((g) => g.userId)).toEqual(["b", "a", "c"]);
    expect(ranked[0].diff).toBe(100);
  });
});
