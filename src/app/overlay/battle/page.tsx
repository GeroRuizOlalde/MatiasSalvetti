import { Suspense } from "react";
import { Bracket } from "@/components/battles/bracket";
import { OverlayGate, overlayPanel } from "@/components/overlay/overlay-gate";
import { getPublicBattle, getPublicBattles } from "@/lib/battles";
import { currentMatch, groupRounds, sideMulti } from "@/lib/calc/bracket";
import { cn } from "@/lib/cn";
import { formatMulti } from "@/lib/format";

export default function BattleOverlayPage({ searchParams }: PageProps<"/overlay/battle">) {
  return (
    <Suspense fallback={null}>
      <OverlayGate searchParams={searchParams}>
        <BattleOverlay />
      </OverlayGate>
    </Suspense>
  );
}

async function BattleOverlay() {
  const summary = (await getPublicBattles()).find((b) => b.status === "live" || b.status === "finished");
  const battle = summary ? await getPublicBattle(summary.id) : null;
  if (!battle || battle.status === "open") {
    return <p className={cn(overlayPanel, "text-sm text-muted")}>No hay una Bonus Battle en juego.</p>;
  }

  const name = (id: string | null) => battle.entries.find((e) => e.id === id)?.slot_name ?? "Por definir";
  const match = currentMatch(battle.matches);
  const rounds = groupRounds(battle.matches);
  const round = match ? rounds.find((r) => r.round === match.round) : null;
  const champion = battle.entries.find((e) => e.id === battle.winner_entry_id);

  return (
    <div className="w-[1256px] space-y-3">
      <div className={cn(overlayPanel, "flex items-center gap-6")}>
        <h1 className="font-display text-2xl tracking-wide uppercase">{battle.title}</h1>
        {champion ? (
          <p className="ml-auto font-display text-3xl tracking-wide text-gold uppercase">🏆 {champion.slot_name}</p>
        ) : match ? (
          <div className="ml-auto flex items-center gap-4">
            <span className="text-xs tracking-wide text-subtle uppercase">{round?.name}</span>
            <Side name={name(match.entry_a)} multi={sideMulti(match.bet_a, match.payout_a)} />
            <span className="font-display text-2xl text-live">VS</span>
            <Side name={name(match.entry_b)} multi={sideMulti(match.bet_b, match.payout_b)} />
          </div>
        ) : null}
      </div>
      <div className={overlayPanel}>
        <Bracket
          matches={battle.matches}
          entries={battle.entries}
          currency={battle.currency}
          currentId={match?.id ?? null}
        />
      </div>
    </div>
  );
}

function Side({ name, multi }: { name: string; multi: number | null }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="max-w-64 truncate text-lg font-semibold">{name}</span>
      <span className="num font-bold text-gold">{multi !== null ? formatMulti(multi) : "…"}</span>
    </span>
  );
}
