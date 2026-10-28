import Link from "next/link";
import { huntStats } from "@/lib/calc/hunt";
import { formatDate, formatInteger, formatMoney, formatMulti } from "@/lib/format";
import type { HuntSummary } from "@/lib/hunts";
import { HuntStatusBadge } from "./status-badge";

export function HuntCard({ hunt }: { hunt: HuntSummary }) {
  const stats = huntStats(hunt.start_cost, hunt.bonuses);
  const facts = [
    { label: "Bonos", value: `${formatInteger(stats.opened)}/${formatInteger(stats.bonuses)}` },
    { label: "Inversión", value: formatMoney(hunt.start_cost, hunt.currency) },
    {
      label: hunt.final_balance !== null ? "Balance final" : "Ganado",
      value: formatMoney(hunt.final_balance ?? stats.won, hunt.currency),
    },
    { label: "Mejor multi", value: stats.best ? formatMulti(stats.best.multi) : "—" },
  ];

  return (
    <Link
      href={`/bonus-hunt/${hunt.id}`}
      className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/60"
    >
      <div className="flex items-center justify-between gap-3">
        <HuntStatusBadge status={hunt.status} />
        <span className="text-xs text-subtle">{formatDate(hunt.created_at)}</span>
      </div>
      <h2 className="mt-3 font-display text-2xl tracking-wide uppercase">{hunt.title}</h2>
      {hunt.casino ? <p className="text-sm text-muted">en {hunt.casino.name}</p> : null}
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
