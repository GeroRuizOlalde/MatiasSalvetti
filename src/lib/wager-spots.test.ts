import { describe, expect, it } from "vitest";
import { openPrizeSpots, spotsToShow } from "./wager-spots";

describe("puestos de la Wager Race", () => {
  it("completa los puestos con premio que no tienen a nadie", () => {
    expect(openPrizeSpots(3, [500, 300, 200, 100, 50])).toEqual([
      { rank: 4, prize: 100 },
      { rank: 5, prize: 50 },
    ]);
    expect(openPrizeSpots(0, [500, 300])).toEqual([
      { rank: 1, prize: 500 },
      { rank: 2, prize: 300 },
    ]);
    expect(openPrizeSpots(6, [500, 300])).toEqual([]);
    expect(openPrizeSpots(1, [500, 300, 200, 100], 3)).toEqual([
      { rank: 2, prize: 300 },
      { rank: 3, prize: 200 },
    ]);
  });

  it("muestra tantos lugares como premios, con un mínimo y un máximo", () => {
    expect(spotsToShow([1, 2, 3, 4, 5], 3, 10)).toBe(5);
    expect(spotsToShow([1], 3, 10)).toBe(3);
    expect(spotsToShow(new Array(20).fill(1), 3, 10)).toBe(10);
  });
});
