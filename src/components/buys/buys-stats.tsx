import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { BuysStats } from "@/lib/calc/buys";
import { cn } from "@/lib/cn";
import { formatInteger, formatMoney, formatMulti } from "@/lib/format";
import type { Enums } from "@/types/database";

export function BuysStatsGrid({
  stats,
  currency,
  className,
  lang = "es",
}: {
  stats: BuysStats;
  currency: Enums<"currency_code">;
  className?: string;
  lang?: Locale;
}) {
  const c = getI18n(lang).t.common;
  const items: { label: string; value: string; tone?: "gold" | "good" | "bad" }[] = [
    { label: c.buys, value: `${formatInteger(stats.opened)}/${formatInteger(stats.buys)}` },
    { label: c.spent, value: formatMoney(stats.totalCost, currency) },
    { label: c.paid, value: formatMoney(stats.totalPayout, currency), tone: "gold" },
    {
      label: c.result,
      value: stats.opened ? `${stats.profit >= 0 ? "+" : ""}${formatMoney(stats.profit, currency)}` : "—",
      tone: stats.opened ? (stats.profit >= 0 ? "good" : "bad") : undefined,
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
        </div>
      ))}
    </dl>
  );
}
