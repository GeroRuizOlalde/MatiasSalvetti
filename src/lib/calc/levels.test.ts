import { describe, expect, it } from "vitest";
import { levelFromXp, totalXpForLevel, xpToNextLevel } from "./levels";

describe("curva de niveles", () => {
  it("usa 300 · n^1.15 por tramo", () => {
    expect(xpToNextLevel(1)).toBe(300);
    expect(xpToNextLevel(2)).toBe(666);
    expect(xpToNextLevel(3)).toBe(1061);
    expect(xpToNextLevel(10)).toBe(4238);
  });

  it("acumula los tramos", () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(300);
    expect(totalXpForLevel(3)).toBe(966);
  });

  it("calcula nivel y progreso desde la XP acumulada", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 300, progress: 0 });
    expect(levelFromXp(299).level).toBe(1);
    expect(levelFromXp(300)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForNext: 666 });
    expect(levelFromXp(633)).toMatchObject({ level: 2, xpIntoLevel: 333, progress: 0.5 });
  });

  it("acepta una curva configurada", () => {
    expect(levelFromXp(100, { base: 100, exponent: 1 })).toMatchObject({ level: 2, xpForNext: 200 });
  });
});
