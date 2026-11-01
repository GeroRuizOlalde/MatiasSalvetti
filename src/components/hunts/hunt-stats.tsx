import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { HuntStats } from "@/lib/calc/hunt";
import { cn } from "@/lib/cn";
import { formatInteger, formatMoney, formatMulti } from "@/lib/format";
import type { Enums } from "@/types/database";

type Props = {
  stats: HuntStats;
  startCost: number;
  /** Con cuánto se empezó a abrir los bonos. */
  openingBalance: number;
  currency: Enums<"currency_code">;
  finalBalance: number | null;
  className?: string;
  lang?: Locale;
};

export function HuntStatsGrid({
  stats,
  startCost,
  openingBalance,
  currency,
  finalBalance,
  className,
  lang = "es",
}: Props) {
  const c = getI18n(lang).t.common;
  const finished = finalBalance !== null;
  const profit = finished ? finalBalance - startCost : null;

  const items: { label: string; value: string; note?: string; tone?: "gold" | "good" | "bad" }[] = [
    {
      label: c.investment,
      value: formatMoney(startCost, currency),
      note: openingBalance > 0 ? c.openingBalance(formatMoney(openingBalance, currency)) : undefined,
    },
    { label: c.bonuses, value: `${formatInteger(stats.opened)}/${formatInteger(stats.bonuses)}` },
    {
      // Con saldo de apertura, lo que importa es el balance (saldo + lo pagado), no solo lo pagado.
      label: finished ? c.finalBalance : openingBalance > 0 ? c.currentBalance : c.won,
      value: formatMoney(finalBalance ?? stats.balance, currency),
      tone: "gold",
    },
    finished
      ? {
          label: c.result,
          value: `${profit! >= 0 ? "+" : ""}${formatMoney(profit!, currency)}`,
          tone: profit! >= 0 ? "good" : "bad",
        }
      : {
          label: c.requiredMulti,
          // Sin bonos por abrir no hay multi necesario.
          value: stats.requiredMulti !== null ? formatMulti(stats.requiredMulti) : "—",
        },
    { label: c.averageMulti, value: stats.averageMulti !== null ? formatMulti(stats.averageMulti) : "—" },
    { label: c.bestMulti, value: stats.best ? formatMulti(stats.best.multi) : "—" },
  ];

  return (
    <dl className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6", className)}>
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-line bg-surface px-4 py-3">
          <dt className="text-xs text-subtle">{item.label}</dt>
          <dd
            className={cn(
              "num mt-1 text-lg font-bold",
              item.tone === "gold" && "text-gold",
              item.tone === "good" && "text-emerald-400",
              item.tone === "bad" && "text-live",
            )}
          >
            {item.value}
          </dd>
          {item.note ? <dd className="num mt-0.5 text-xs text-subtle">{item.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
