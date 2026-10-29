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
};

export function HuntStatsGrid({ stats, startCost, openingBalance, currency, finalBalance, className }: Props) {
  const finished = finalBalance !== null;
  const profit = finished ? finalBalance - startCost : null;

  const items: { label: string; value: string; note?: string; tone?: "gold" | "good" | "bad" }[] = [
    {
      label: "Inversión",
      value: formatMoney(startCost, currency),
      note: openingBalance > 0 ? `Saldo al abrir: ${formatMoney(openingBalance, currency)}` : undefined,
    },
    { label: "Bonos", value: `${formatInteger(stats.opened)}/${formatInteger(stats.bonuses)}` },
    {
      // Con saldo de apertura, lo que importa es el balance (saldo + lo pagado), no solo lo pagado.
      label: finished ? "Balance final" : openingBalance > 0 ? "Balance actual" : "Ganado",
      value: formatMoney(finalBalance ?? stats.balance, currency),
      tone: "gold",
    },
    finished
      ? {
          label: "Resultado",
          value: `${profit! >= 0 ? "+" : ""}${formatMoney(profit!, currency)}`,
          tone: profit! >= 0 ? "good" : "bad",
        }
      : {
          label: "Multi necesario",
          // Sin bonos por abrir no hay multi necesario.
          value: stats.requiredMulti !== null ? formatMulti(stats.requiredMulti) : "—",
        },
    { label: "Multi promedio", value: stats.averageMulti !== null ? formatMulti(stats.averageMulti) : "—" },
    { label: "Mejor multi", value: stats.best ? formatMulti(stats.best.multi) : "—" },
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
