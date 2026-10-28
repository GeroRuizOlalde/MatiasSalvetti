import { Gift, Trophy } from "lucide-react";
import { Suspense } from "react";
import { OverlayGate, overlayPanel } from "@/components/overlay/overlay-gate";
import { Countdown } from "@/components/wager/countdown";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";
import { getPublicGiveaways } from "@/lib/giveaways";

export default function SorteoOverlayPage({ searchParams }: PageProps<"/overlay/sorteo">) {
  return (
    <Suspense fallback={null}>
      <OverlayGate searchParams={searchParams}>
        <SorteoOverlay />
      </OverlayGate>
    </Suspense>
  );
}

async function SorteoOverlay() {
  const giveaways = await getPublicGiveaways();
  // El abierto; si no hay, el último que ya tiene ganadores.
  const giveaway = giveaways.find((g) => g.phase === "open") ?? giveaways.find((g) => g.winners.length > 0);
  if (!giveaway) return <p className={cn(overlayPanel, "text-sm text-muted")}>No hay sorteos abiertos.</p>;

  return (
    <div className={cn(overlayPanel, "flex w-[536px] items-center gap-4")}>
      {giveaway.winners.length ? (
        <Trophy className="size-12 shrink-0 text-gold" aria-hidden />
      ) : (
        <Gift className="size-12 shrink-0 text-accent-text" aria-hidden />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs tracking-wide text-subtle uppercase">Sorteo · {giveaway.title}</p>
        <p className="truncate font-display text-2xl tracking-wide text-gold uppercase">{giveaway.prize}</p>
        {giveaway.winners.length ? (
          <p className="truncate text-sm">
            Ganó <strong>{giveaway.winners.map((w) => w.name).join(", ")}</strong>
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Anotate en la web · <span className="num text-text">{formatInteger(giveaway.participants)}</span> anotados
            </p>
            <Countdown target={giveaway.ends_at} label="Cierra en" />
          </>
        )}
      </div>
    </div>
  );
}
