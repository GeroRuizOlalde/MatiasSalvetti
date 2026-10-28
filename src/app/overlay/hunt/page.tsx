import { Suspense } from "react";
import { OverlayGate, overlayPanel } from "@/components/overlay/overlay-gate";
import { huntStats } from "@/lib/calc/hunt";
import { cn } from "@/lib/cn";
import { formatInteger, formatMoney, formatMulti } from "@/lib/format";
import { isHuntActive } from "@/lib/hunt-status";
import { getPublicHunt, getPublicHunts } from "@/lib/hunts";

const VISIBLE = 12;

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

  const stats = huntStats(hunt.start_cost, hunt.bonusList);
  const next = hunt.bonusList.findIndex((b) => b.payout === null);
  // Ventana de bonos alrededor del próximo a abrir.
  const start = Math.max(
    0,
    Math.min((next === -1 ? hunt.bonusList.length : next) - 3, hunt.bonusList.length - VISIBLE),
  );
  const visible = hunt.bonusList.slice(start, start + VISIBLE);

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
        <Stat label="Ganado" value={formatMoney(stats.won, hunt.currency)} gold />
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
      <ol className="space-y-1">
        {visible.map((bonus, i) => {
          const index = start + i;
          const isNext = index === next;
          return (
            <li
              key={bonus.id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                isNext ? "bg-accent/30 ring-1 ring-accent" : "bg-white/5",
                bonus.payout === null && !isNext && "text-muted",
              )}
            >
              <span className="num w-6 text-xs text-subtle">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{bonus.slot_name}</span>
              <span className="num w-20 text-right text-xs text-muted">{formatMoney(bonus.bet, hunt.currency)}</span>
              <span
                className={cn(
                  "num w-20 text-right font-bold",
                  stats.best?.index === index ? "text-gold" : "text-accent-light",
                )}
              >
                {bonus.multi !== null ? formatMulti(bonus.multi) : isNext ? "▶" : ""}
              </span>
            </li>
          );
        })}
      </ol>
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
    <div className="rounded-lg bg-white/5 px-2 py-1.5">
      <dt className="text-[10px] tracking-wide text-subtle uppercase">{label}</dt>
      <dd className={cn("num text-sm font-bold", gold ? "text-gold" : "text-text")}>{value}</dd>
    </div>
  );
}
