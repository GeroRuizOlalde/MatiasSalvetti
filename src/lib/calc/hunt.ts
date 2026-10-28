// Números de un Bonus Hunt a partir de la inversión inicial y los bonos.
// "Multi" es payout / apuesta. El multi necesario es el promedio que tienen que
// pagar los bonos que faltan abrir para recuperar la inversión.

export type HuntBonusAmounts = { bet: number; payout: number | null };

export type HuntStats = {
  bonuses: number;
  opened: number;
  totalBet: number;
  /** Suma de lo pagado por los bonos abiertos. */
  won: number;
  /** Apuestas de los bonos que faltan abrir. */
  remainingBet: number;
  /** Multi promedio de los bonos abiertos (ponderado por apuesta), o null si no hay. */
  averageMulti: number | null;
  /** Multi promedio necesario en los bonos sin abrir para empatar. null si ya no faltan bonos. 0 si ya se recuperó. */
  requiredMulti: number | null;
  /** Multi para empatar antes de abrir ninguno (inversión / apuestas totales). */
  breakEvenMulti: number | null;
  best: { index: number; multi: number } | null;
  /** Ganado menos inversión. */
  profit: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function bonusMulti(bonus: HuntBonusAmounts) {
  return bonus.payout === null || bonus.bet <= 0 ? null : bonus.payout / bonus.bet;
}

export function huntStats(startCost: number, bonuses: HuntBonusAmounts[]): HuntStats {
  let totalBet = 0;
  let won = 0;
  let openedBet = 0;
  let opened = 0;
  let best: HuntStats["best"] = null;

  bonuses.forEach((bonus, index) => {
    totalBet += bonus.bet;
    const multi = bonusMulti(bonus);
    if (multi === null || bonus.payout === null) return;
    opened += 1;
    won += bonus.payout;
    openedBet += bonus.bet;
    if (!best || multi > best.multi) best = { index, multi };
  });

  const remainingBet = totalBet - openedBet;
  const missing = startCost - won;

  return {
    bonuses: bonuses.length,
    opened,
    totalBet: round2(totalBet),
    won: round2(won),
    remainingBet: round2(remainingBet),
    averageMulti: openedBet > 0 ? won / openedBet : null,
    requiredMulti: remainingBet > 0 ? Math.max(0, missing) / remainingBet : null,
    breakEvenMulti: totalBet > 0 ? startCost / totalBet : null,
    best,
    profit: round2(won - startCost),
  };
}

export type Guess = { userId: string; amount: number; updatedAt: string };

/** GTB ordenado del más cercano al más lejano; en empate gana el que cargó primero (igual que en la base). */
export function rankGuesses<T extends Guess>(guesses: T[], finalBalance: number) {
  return guesses
    .map((guess) => ({ ...guess, diff: Math.abs(guess.amount - finalBalance) }))
    .sort((a, b) => a.diff - b.diff || a.updatedAt.localeCompare(b.updatedAt));
}
