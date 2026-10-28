import { Medal } from "lucide-react";
import { Suspense } from "react";
import { OverlayGate, overlayPanel } from "@/components/overlay/overlay-gate";
import { Countdown } from "@/components/wager/countdown";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { getLeaderboard, getWagerOverview } from "@/lib/wager";

const MEDAL = ["text-gold", "text-[#c9d1dd]", "text-[#d08a4f]"];

export default function WagerOverlayPage({ searchParams }: PageProps<"/overlay/wager">) {
  return (
    <Suspense fallback={null}>
      <OverlayGate searchParams={searchParams}>
        <WagerOverlay />
      </OverlayGate>
    </Suspense>
  );
}

async function WagerOverlay() {
  const { featured: race } = await getWagerOverview();
  if (!race) return <p className={cn(overlayPanel, "text-sm text-muted")}>No hay una Wager Race publicada.</p>;
  const top = await getLeaderboard(race.id, 5);

  return (
    <div className={cn(overlayPanel, "w-[396px] space-y-3")}>
      <div>
        <p className="text-xs tracking-wide text-subtle uppercase">
          Wager Race{race.casino ? ` · ${race.casino.name}` : ""}
        </p>
        <h1 className="truncate font-display text-2xl tracking-wide uppercase">{race.title}</h1>
      </div>
      {race.phase !== "ended" ? (
        <Countdown
          target={race.phase === "upcoming" ? race.starts_at : race.ends_at}
          label={race.phase === "upcoming" ? "Arranca en" : "Termina en"}
        />
      ) : (
        <p className="text-sm text-muted">Terminada</p>
      )}
      <ol className="space-y-1">
        {top.map((row) => (
          <li key={row.user_id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-sm">
            {row.rank <= 3 ? (
              <Medal className={cn("size-4 shrink-0", MEDAL[row.rank - 1])} aria-hidden />
            ) : (
              <span className="num w-4 text-center text-xs text-subtle">{row.rank}</span>
            )}
            <span className="min-w-0 flex-1 truncate font-semibold">{row.display_name}</span>
            <span className="num text-xs text-muted">{formatMoney(row.wager, race.currency)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
