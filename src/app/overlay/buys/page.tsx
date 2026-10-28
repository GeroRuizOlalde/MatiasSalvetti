import { Suspense } from "react";
import { PollResults } from "@/components/buys/poll-results";
import { OverlayGate, overlayPanel } from "@/components/overlay/overlay-gate";
import { getPublicBuySession, getPublicBuySessions } from "@/lib/buys";
import { buysStats } from "@/lib/calc/buys";
import { cn } from "@/lib/cn";
import { formatInteger, formatMoney, formatMulti } from "@/lib/format";

export default function BuysOverlayPage({ searchParams }: PageProps<"/overlay/buys">) {
  return (
    <Suspense fallback={null}>
      <OverlayGate searchParams={searchParams}>
        <BuysOverlay />
      </OverlayGate>
    </Suspense>
  );
}

async function BuysOverlay() {
  const summary = (await getPublicBuySessions()).find((s) => s.status === "live");
  const session = summary ? await getPublicBuySession(summary.id) : null;
  if (!session) return <p className={cn(overlayPanel, "text-sm text-muted")}>No hay una sesión de Buys en vivo.</p>;

  const stats = buysStats(session.buyList);
  const poll = session.polls.find((p) => p.isOpen);
  const last = session.buyList.slice(-5).reverse();

  return (
    <div className="w-[456px] space-y-3">
      <div className={cn(overlayPanel, "space-y-3")}>
        <h1 className="truncate font-display text-2xl tracking-wide uppercase">{session.title}</h1>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/5 px-2 py-1.5">
            <dt className="text-[10px] tracking-wide text-subtle uppercase">Compras</dt>
            <dd className="num text-sm font-bold">{formatInteger(stats.buys)}</dd>
          </div>
          <div className="rounded-lg bg-white/5 px-2 py-1.5">
            <dt className="text-[10px] tracking-wide text-subtle uppercase">Resultado</dt>
            <dd className={cn("num text-sm font-bold", stats.profit >= 0 ? "text-emerald-400" : "text-live")}>
              {stats.opened ? `${stats.profit >= 0 ? "+" : ""}${formatMoney(stats.profit, session.currency)}` : "—"}
            </dd>
          </div>
          <div className="rounded-lg bg-white/5 px-2 py-1.5">
            <dt className="text-[10px] tracking-wide text-subtle uppercase">Mejor multi</dt>
            <dd className="num text-sm font-bold text-gold">{stats.best ? formatMulti(stats.best.multi) : "—"}</dd>
          </div>
        </dl>
        {last.length ? (
          <ol className="space-y-1">
            {last.map((buy) => (
              <li key={buy.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">{buy.slot_name}</span>
                <span className="num text-xs text-muted">{formatMoney(buy.cost, session.currency)}</span>
                <span className="num w-20 text-right font-bold text-accent-light">
                  {buy.multi !== null ? formatMulti(buy.multi) : "…"}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
      {poll ? (
        <div className={cn(overlayPanel, "space-y-2")}>
          <p className="flex items-center justify-between font-display text-xl tracking-wide uppercase">
            ¿Qué compramos?{" "}
            <span className="num text-xs font-normal text-muted">{formatInteger(poll.totalVotes)} votos</span>
          </p>
          <PollResults options={poll.options} totalVotes={poll.totalVotes} />
        </div>
      ) : null}
    </div>
  );
}
