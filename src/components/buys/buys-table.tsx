import { Crown } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoney, formatMulti } from "@/lib/format";
import type { PublicBuy } from "@/lib/buys";
import type { Enums } from "@/types/database";

export function BuysTable({
  buys,
  currency,
  bestIndex,
}: {
  buys: PublicBuy[];
  currency: Enums<"currency_code">;
  bestIndex: number | null;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-subtle">
            <th scope="col" className="px-4 py-3 font-semibold">
              #
            </th>
            <th scope="col" className="px-2 py-3 font-semibold">
              Slot
            </th>
            <th scope="col" className="hidden px-2 py-3 text-right font-semibold sm:table-cell">
              Apuesta
            </th>
            <th scope="col" className="px-2 py-3 text-right font-semibold">
              Costo
            </th>
            <th scope="col" className="px-2 py-3 text-right font-semibold">
              Pago
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Multi
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {buys.map((buy, i) => {
            const best = i === bestIndex;
            const opened = buy.payout !== null;
            const profit = opened ? buy.payout! - buy.cost : null;
            return (
              <tr key={buy.id} className={cn(best && "bg-gold/5", !opened && "text-muted")}>
                <td className="num px-4 py-3 text-subtle">{i + 1}</td>
                <td className="max-w-48 px-2 py-3">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-text">
                    {best ? <Crown className="size-4 shrink-0 text-gold" aria-label="Mejor multi" /> : null}
                    <span className="truncate">{buy.slot_name}</span>
                  </p>
                  <p className="truncate text-xs text-subtle">{buy.provider}</p>
                </td>
                <td className="num hidden px-2 py-3 text-right whitespace-nowrap sm:table-cell">
                  {formatMoney(buy.bet, currency)}
                </td>
                <td className="num px-2 py-3 text-right whitespace-nowrap">{formatMoney(buy.cost, currency)}</td>
                <td className="px-2 py-3 text-right whitespace-nowrap">
                  <span className="num block">{opened ? formatMoney(buy.payout!, currency) : "—"}</span>
                  {profit !== null ? (
                    <span className={cn("num block text-xs", profit >= 0 ? "text-emerald-400" : "text-live")}>
                      {profit >= 0 ? "+" : ""}
                      {formatMoney(profit, currency)}
                    </span>
                  ) : null}
                </td>
                <td
                  className={cn(
                    "num px-4 py-3 text-right font-semibold whitespace-nowrap",
                    opened ? (best ? "text-gold" : "text-accent-light") : "text-subtle",
                  )}
                >
                  {buy.multi !== null ? formatMulti(buy.multi) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
