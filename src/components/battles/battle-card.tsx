import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate, formatInteger } from "@/lib/format";
import type { BattleSummary } from "@/lib/battles";
import { BATTLE_STATUSES, statusInfo } from "@/lib/session-status";

export function BattleCard({ battle }: { battle: BattleSummary }) {
  const status = statusInfo(BATTLE_STATUSES, battle.status);
  const champion = battle.entries.find((e) => e.id === battle.winner_entry_id);

  return (
    <Link
      href={`/bonus-battle/${battle.id}`}
      className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/60"
    >
      <div className="flex items-center justify-between gap-3">
        <StatusPill label={status.label} tone={status.tone} />
        <span className="text-xs text-subtle">{formatDate(battle.created_at)}</span>
      </div>
      <h2 className="mt-3 font-display text-2xl tracking-wide uppercase">{battle.title}</h2>
      {battle.casino ? <p className="text-sm text-muted">en {battle.casino.name}</p> : null}
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <dt className="text-xs text-subtle">Slots</dt>
          <dd className="num font-semibold text-gold">{formatInteger(battle.entries.length)}</dd>
        </div>
        <div className="min-w-0 rounded-lg bg-surface-2 px-3 py-2">
          <dt className="text-xs text-subtle">Campeón</dt>
          <dd className="truncate font-semibold text-gold">{champion?.slot_name ?? "—"}</dd>
        </div>
      </dl>
    </Link>
  );
}
