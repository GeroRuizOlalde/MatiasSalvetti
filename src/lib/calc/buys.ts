// Números de una sesión de Bonus Buys. Cada compra cuesta `cost` y se juega a
// `bet`; el multi es payout / bet y el resultado de la sesión, pagado - costo.

export type BuyAmounts = { bet: number; cost: number; payout: number | null };

export type BuysStats = {
  buys: number;
  opened: number;
  /** Lo gastado en todas las compras, abiertas o no. */
  totalCost: number;
  totalPayout: number;
  /** Pagado menos costo de las compras abiertas. */
  profit: number;
  /** Multi promedio de las abiertas (ponderado por apuesta), o null. */
  averageMulti: number | null;
  best: { index: number; multi: number } | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buysStats(buys: BuyAmounts[]): BuysStats {
  let totalCost = 0;
  let openedCost = 0;
  let openedBet = 0;
  let totalPayout = 0;
  let opened = 0;
  let best: BuysStats["best"] = null;

  buys.forEach((buy, index) => {
    totalCost += buy.cost;
    if (buy.payout === null || buy.bet <= 0) return;
    opened += 1;
    openedCost += buy.cost;
    openedBet += buy.bet;
    totalPayout += buy.payout;
    const multi = buy.payout / buy.bet;
    if (!best || multi > best.multi) best = { index, multi };
  });

  return {
    buys: buys.length,
    opened,
    totalCost: round2(totalCost),
    totalPayout: round2(totalPayout),
    profit: round2(totalPayout - openedCost),
    averageMulti: openedBet > 0 ? totalPayout / openedBet : null,
    best,
  };
}
