import { Crown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { formatMoney, formatMulti } from "@/lib/format";
import type { PublicHuntBonus } from "@/lib/hunts";
import type { Enums } from "@/types/database";

export function BonusTable({
  bonuses,
  currency,
  bestIndex,
}: {
  bonuses: PublicHuntBonus[];
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
            <th scope="col" className="hidden px-2 py-3 font-semibold md:table-cell">
              Call
            </th>
            <th scope="col" className="px-2 py-3 text-right font-semibold">
              Apuesta
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
          {bonuses.map((bonus, i) => {
            const best = i === bestIndex;
            const opened = bonus.payout !== null;
            return (
              <tr key={bonus.id} className={cn(best && "bg-gold/5", !opened && "text-muted")}>
                <td className="num px-4 py-3 text-subtle">{i + 1}</td>
                <td className="max-w-48 px-2 py-3">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-text">
                    {best ? <Crown className="size-4 shrink-0 text-gold" aria-label="Mejor multi" /> : null}
                    <span className="truncate">{bonus.slot_name}</span>
                  </p>
                  <p className="truncate text-xs text-subtle">
                    {bonus.provider}
                    {bonus.calledBy ? <span className="md:hidden"> · {bonus.calledBy.name}</span> : null}
                  </p>
                </td>
                <td className="hidden px-2 py-3 md:table-cell">
                  {bonus.calledBy ? (
                    <span className="flex items-center gap-2">
                      <Avatar url={bonus.calledBy.avatarUrl} name={bonus.calledBy.name} size={22} />
                      <span className="truncate">{bonus.calledBy.name}</span>
                    </span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </td>
                <td className="num px-2 py-3 text-right whitespace-nowrap">{formatMoney(bonus.bet, currency)}</td>
                <td className="num px-2 py-3 text-right whitespace-nowrap">
                  {opened ? formatMoney(bonus.payout!, currency) : "—"}
                </td>
                <td
                  className={cn(
                    "num px-4 py-3 text-right font-semibold whitespace-nowrap",
                    opened ? (best ? "text-gold" : "text-accent-light") : "text-subtle",
                  )}
                >
                  {bonus.multi !== null ? formatMulti(bonus.multi) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
