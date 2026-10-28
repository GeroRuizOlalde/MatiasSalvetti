// Cuadro de una Bonus Battle a partir de los cruces guardados en la base.

export type BracketMatch = {
  id: string;
  round: number;
  slot: number;
  entry_a: string | null;
  entry_b: string | null;
  bet_a: number | null;
  payout_a: number | null;
  bet_b: number | null;
  payout_b: number | null;
  winner_entry_id: string | null;
};

/** Nombre de la ronda según cuántas faltan para la final. */
export function roundName(round: number, totalRounds: number) {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Cuartos";
  if (fromEnd === 3) return "Octavos";
  return `Ronda ${round}`;
}

export function sideMulti(bet: number | null, payout: number | null) {
  return bet !== null && payout !== null && bet > 0 ? payout / bet : null;
}

/** Rondas en orden, cada una con sus cruces ordenados. */
export function groupRounds<T extends BracketMatch>(matches: T[]) {
  const total = matches.reduce((max, m) => Math.max(max, m.round), 0);
  return Array.from({ length: total }, (_, i) => ({
    round: i + 1,
    name: roundName(i + 1, total),
    matches: matches.filter((m) => m.round === i + 1).sort((a, b) => a.slot - b.slot),
  }));
}

/** Cruce que se está jugando: el primero con los dos slots y sin ganador. */
export function currentMatch<T extends BracketMatch>(matches: T[]) {
  return (
    [...matches]
      .sort((a, b) => a.round - b.round || a.slot - b.slot)
      .find((m) => m.entry_a && m.entry_b && !m.winner_entry_id) ?? null
  );
}

export const VALID_ENTRY_COUNTS = [2, 4, 8, 16];
