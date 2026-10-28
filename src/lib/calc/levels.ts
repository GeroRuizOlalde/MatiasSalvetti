// Curva de niveles: para pasar del nivel n al n+1 hacen falta round(base · n^exponent) XP.
// Con los valores por defecto: 1→2 = 300, 2→3 = 666, 3→4 = 1.061, ... La XP de
// cada usuario es acumulada, así que el nivel se calcula sumando esos tramos.

export type LevelCurve = { base: number; exponent: number };

export const DEFAULT_LEVEL_CURVE: LevelCurve = { base: 300, exponent: 1.15 };

const MAX_LEVEL = 1000;

/** XP necesaria para pasar del nivel `level` al siguiente. */
export function xpToNextLevel(level: number, curve: LevelCurve = DEFAULT_LEVEL_CURVE) {
  return Math.round(curve.base * Math.pow(level, curve.exponent));
}

/** XP acumulada necesaria para llegar a `level` (nivel 1 = 0). */
export function totalXpForLevel(level: number, curve: LevelCurve = DEFAULT_LEVEL_CURVE) {
  let total = 0;
  for (let n = 1; n < level; n++) total += xpToNextLevel(n, curve);
  return total;
}

export type LevelProgress = {
  level: number;
  /** XP acumulada dentro del nivel actual. */
  xpIntoLevel: number;
  /** XP total del tramo actual. */
  xpForNext: number;
  /** 0 a 1. */
  progress: number;
};

export function levelFromXp(xp: number, curve: LevelCurve = DEFAULT_LEVEL_CURVE): LevelProgress {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  while (level < MAX_LEVEL) {
    const needed = xpToNextLevel(level, curve);
    if (remaining < needed) break;
    remaining -= needed;
    level += 1;
  }
  const xpForNext = xpToNextLevel(level, curve);
  return { level, xpIntoLevel: remaining, xpForNext, progress: xpForNext > 0 ? remaining / xpForNext : 1 };
}
