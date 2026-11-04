// Puestos con premio que todavía no tienen a nadie: se muestran como «Puesto libre» para
// que el ranking tenga siempre tantos lugares como premios.

export function openPrizeSpots(taken: number, prizes: number[], upTo = prizes.length) {
  return prizes.slice(taken, Math.max(taken, upTo)).map((prize, i) => ({ rank: taken + i + 1, prize }));
}

/** Cuántos puestos mostrar en un resumen: los que tienen premio, entre `min` y `max`. */
export function spotsToShow(prizes: number[], min: number, max: number) {
  return Math.min(Math.max(prizes.length, min), max);
}
