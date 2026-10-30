import { Suspense } from "react";
import { BonusTicker } from "@/components/overlay/bonus-ticker";
import { OverlayGate, overlayPanel } from "@/components/overlay/overlay-gate";
import { huntStats } from "@/lib/calc/hunt";
import { cn } from "@/lib/cn";
import { formatInteger, formatMoney, formatMulti } from "@/lib/format";
import { isHuntActive } from "@/lib/hunt-status";
import { getPublicHunt, getPublicHunts } from "@/lib/hunts";

export default function HuntOverlayPage({ searchParams }: PageProps<"/overlay/hunt">) {
  return (
    <Suspense fallback={null}>
      <OverlayGate searchParams={searchParams}>
        <HuntOverlay />
      </OverlayGate>
    </Suspense>
  );
}

async function HuntOverlay() {
  const summary = (await getPublicHunts()).find((h) => isHuntActive(h.status));
  const hunt = summary ? await getPublicHunt(summary.id) : null;
  if (!hunt) return <p className={cn(overlayPanel, "text-sm text-muted")}>No hay un Bonus Hunt en curso.</p>;

  const stats = huntStats(hunt.start_cost, hunt.bonusList, hunt.opening_balance);
  const next = hunt.bonusList.findIndex((b) => b.payout === null);
  return (
    <div className={cn(overlayPanel, "w-[456px] space-y-3")}>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="truncate font-display text-2xl tracking-wide uppercase">{hunt.title}</h1>
        <span className="num text-sm text-muted">
          {formatInteger(stats.opened)}/{formatInteger(stats.bonuses)}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Inversión" value={formatMoney(hunt.start_cost, hunt.currency)} />
        <Stat
          label={hunt.opening_balance > 0 ? "Balance" : "Ganado"}
          value={formatMoney(stats.balance, hunt.currency)}
          gold
        />
        <Stat
          label={stats.requiredMulti !== null ? "Multi necesario" : "Multi promedio"}
          value={
            stats.requiredMulti !== null
              ? formatMulti(stats.requiredMulti)
              : stats.averageMulti !== null
                ? formatMulti(stats.averageMulti)
                : "—"
          }
        />
      </dl>
      <BonusTicker
        bonuses={hunt.bonusList}
        currency={hunt.currency}
        nextIndex={next}
        bestIndex={stats.best?.index ?? null}
      />
      {hunt.guesses_open ? (
        <p className="text-center text-xs text-muted">
          Adiviná el balance en la web · <span className="num text-gold">{formatInteger(hunt.guessCount)}</span>{" "}
          apuestas
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-lg bg-white/10 px-2 py-1.5">
      <dt className="text-[11px] font-semibold tracking-wide text-subtle uppercase">{label}</dt>
      <dd className={cn("num text-base font-bold", gold ? "text-gold" : "text-text")}>{value}</dd>
    </div>
  );
}
