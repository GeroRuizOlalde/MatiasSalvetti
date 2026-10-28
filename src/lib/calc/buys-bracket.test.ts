import { describe, expect, it } from "vitest";
import { currentMatch, groupRounds, roundName, sideMulti, type BracketMatch } from "./bracket";
import { buysStats } from "./buys";

describe("buysStats", () => {
  it("sin compras", () => {
    expect(buysStats([])).toMatchObject({ buys: 0, opened: 0, profit: 0, averageMulti: null, best: null });
  });

  it("el resultado solo cuenta las compras abiertas", () => {
    const stats = buysStats([
      { bet: 100, cost: 10000, payout: 25000 },
      { bet: 200, cost: 20000, payout: 4000 },
      { bet: 100, cost: 10000, payout: null },
    ]);
    expect(stats.totalCost).toBe(40000);
    expect(stats.totalPayout).toBe(29000);
    expect(stats.profit).toBe(-1000);
    expect(stats.averageMulti).toBeCloseTo(29000 / 300);
    expect(stats.best).toEqual({ index: 0, multi: 250 });
  });
});

const match = (round: number, slot: number, extra: Partial<BracketMatch> = {}): BracketMatch => ({
  id: `${round}-${slot}`,
  round,
  slot,
  entry_a: null,
  entry_b: null,
  bet_a: null,
  payout_a: null,
  bet_b: null,
  payout_b: null,
  winner_entry_id: null,
  ...extra,
});

describe("bracket", () => {
  it("nombra las rondas desde la final", () => {
    expect([1, 2, 3, 4].map((r) => roundName(r, 4))).toEqual(["Octavos", "Cuartos", "Semifinal", "Final"]);
    expect(roundName(1, 5)).toBe("Ronda 1");
  });

  it("agrupa por ronda y encuentra el cruce en juego", () => {
    const matches = [
      match(2, 0),
      match(1, 1, { entry_a: "c", entry_b: "d" }),
      match(1, 0, { entry_a: "a", entry_b: "b", winner_entry_id: "a" }),
    ];
    const rounds = groupRounds(matches);
    expect(rounds.map((r) => r.name)).toEqual(["Semifinal", "Final"]);
    expect(rounds[0].matches.map((m) => m.slot)).toEqual([0, 1]);
    expect(currentMatch(matches)?.id).toBe("1-1");
  });

  it("multi de un lado", () => {
    expect(sideMulti(10, 250)).toBe(25);
    expect(sideMulti(10, null)).toBeNull();
  });
});
