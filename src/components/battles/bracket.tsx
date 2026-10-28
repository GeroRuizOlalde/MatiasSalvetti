import { Crown } from "lucide-react";
import { groupRounds, sideMulti, type BracketMatch } from "@/lib/calc/bracket";
import { cn } from "@/lib/cn";
import { formatMoney, formatMulti } from "@/lib/format";
import type { BattleEntry } from "@/lib/battles";
import type { Enums } from "@/types/database";

/** Cuadro de eliminación directa: una columna por ronda (scroll horizontal en pantallas chicas). */
export function Bracket({
  matches,
  entries,
  currency,
  currentId,
}: {
  matches: BracketMatch[];
  entries: BattleEntry[];
  currency: Enums<"currency_code">;
  /** Cruce que se está jugando. */
  currentId: string | null;
}) {
  const rounds = groupRounds(matches);
  const entryOf = (id: string | null) => entries.find((e) => e.id === id) ?? null;

  return (
    <div className="overflow-x-auto pb-2">
      <ol className="flex min-w-max gap-4">
        {rounds.map((round) => (
          <li key={round.round} className="flex w-64 flex-col">
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-subtle uppercase">{round.name}</h3>
            <ul className="flex flex-1 flex-col justify-around gap-3">
              {round.matches.map((match) => (
                <li
                  key={match.id}
                  className={cn(
                    "rounded-xl border bg-surface",
                    match.id === currentId ? "border-live/60 shadow-[0_0_20px_-8px_var(--color-live)]" : "border-line",
                  )}
                >
                  {(["a", "b"] as const).map((side) => {
                    const entryId = side === "a" ? match.entry_a : match.entry_b;
                    const entry = entryOf(entryId);
                    const bet = side === "a" ? match.bet_a : match.bet_b;
                    const payout = side === "a" ? match.payout_a : match.payout_b;
                    const multi = sideMulti(bet, payout);
                    const won = Boolean(entryId) && match.winner_entry_id === entryId;
                    const lost = Boolean(match.winner_entry_id) && !won;
                    return (
                      <div
                        key={side}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 text-sm",
                          side === "a" && "border-b border-line",
                          lost && "text-subtle",
                        )}
                      >
                        {won ? <Crown className="size-3.5 shrink-0 text-gold" aria-label="Ganó" /> : null}
                        <span className={cn("min-w-0 flex-1 truncate", won && "font-semibold text-text")}>
                          {entry?.slot_name ?? <span className="text-subtle">Por definir</span>}
                        </span>
                        {payout !== null ? (
                          <span
                            className="num text-xs text-muted"
                            title={bet !== null ? `Apuesta ${formatMoney(bet, currency)}` : undefined}
                          >
                            {formatMoney(payout, currency)}
                          </span>
                        ) : null}
                        <span
                          className={cn("num w-16 text-right text-xs font-semibold", won ? "text-gold" : "text-subtle")}
                        >
                          {multi !== null ? formatMulti(multi) : ""}
                        </span>
                      </div>
                    );
                  })}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
