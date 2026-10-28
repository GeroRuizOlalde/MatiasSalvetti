/** Un bono que vino de un call y pagó más de esto se recomienda como tipeo (igual que tipeo_min_multi() en la base). */
export const TIPEO_MIN_MULTI = 110;

export function isTipeoHit(bonus: { called_by: string | null; bet: number; payout: number | null }) {
  return (
    Boolean(bonus.called_by) && bonus.payout !== null && bonus.bet > 0 && bonus.payout / bonus.bet > TIPEO_MIN_MULTI
  );
}
