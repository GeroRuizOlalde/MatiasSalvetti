import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import Link from "next/link";
import { huntStats } from "@/lib/calc/hunt";
import { formatDate, formatInteger, formatMoney, formatMulti } from "@/lib/format";
import type { HuntSummary } from "@/lib/hunts";
import { HuntStatusBadge } from "./status-badge";

export function HuntCard({ hunt, lang }: { hunt: HuntSummary; lang: Locale }) {
  const { t, href } = getI18n(lang);
  const c = t.common;
  const stats = huntStats(hunt.start_cost, hunt.bonuses, hunt.opening_balance);
  const facts = [
    { label: c.bonuses, value: `${formatInteger(stats.opened)}/${formatInteger(stats.bonuses)}` },
    { label: c.investment, value: formatMoney(hunt.start_cost, hunt.currency) },
    {
      label: hunt.final_balance !== null ? c.finalBalance : hunt.opening_balance > 0 ? c.currentBalance : c.won,
      value: formatMoney(hunt.final_balance ?? stats.balance, hunt.currency),
    },
    { label: c.bestMulti, value: stats.best ? formatMulti(stats.best.multi) : "—" },
  ];

  return (
    <Link
      href={href(`/bonus-hunt/${hunt.id}`)}
      className="lift flex h-full flex-col rounded-2xl border border-line bg-surface p-5 hover:border-accent/60"
    >
      <div className="flex items-center justify-between gap-3">
        <HuntStatusBadge status={hunt.status} lang={lang} />
        <span className="text-xs text-subtle">{formatDate(hunt.created_at, lang)}</span>
      </div>
      <h2 className="mt-3 font-display text-2xl tracking-wide uppercase">{hunt.title}</h2>
      {hunt.casino ? <p className="text-sm text-muted">{c.atCasino(hunt.casino.name)}</p> : null}
      <dl className="mt-4 grid grid-cols-2 gap-2">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-lg bg-surface-2 px-3 py-2">
            <dt className="text-xs text-subtle">{fact.label}</dt>
            <dd className="num font-semibold text-gold">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}
