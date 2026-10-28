import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { buysStats } from "@/lib/calc/buys";
import { formatDate, formatInteger, formatMoney, formatMulti } from "@/lib/format";
import type { BuySessionSummary } from "@/lib/buys";
import { BUY_STATUSES, statusInfo } from "@/lib/session-status";

export function BuySessionCard({ session }: { session: BuySessionSummary }) {
  const stats = buysStats(session.buys);
  const status = statusInfo(BUY_STATUSES, session.status);
  const facts = [
    { label: "Compras", value: formatInteger(stats.buys) },
    { label: "Gastado", value: formatMoney(stats.totalCost, session.currency) },
    {
      label: "Resultado",
      value: stats.opened ? `${stats.profit >= 0 ? "+" : ""}${formatMoney(stats.profit, session.currency)}` : "—",
    },
    { label: "Mejor multi", value: stats.best ? formatMulti(stats.best.multi) : "—" },
  ];

  return (
    <Link
      href={`/bonus-buys/${session.id}`}
      className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/60"
    >
      <div className="flex items-center justify-between gap-3">
        <StatusPill label={status.label} tone={status.tone} />
        <span className="text-xs text-subtle">{formatDate(session.created_at)}</span>
      </div>
      <h2 className="mt-3 font-display text-2xl tracking-wide uppercase">{session.title}</h2>
      {session.casino ? <p className="text-sm text-muted">en {session.casino.name}</p> : null}
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
