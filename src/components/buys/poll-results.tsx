import { Crown } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";

type Option = { id: string; slotName: string; votes: number };

/** Barras de una votación. Con `winnerId` marca la opción ganadora. */
export function PollResults({
  options,
  totalVotes,
  winnerId,
  highlightId,
}: {
  options: Option[];
  totalVotes: number;
  winnerId?: string | null;
  /** El voto del viewer logueado. */
  highlightId?: string | null;
}) {
  return (
    <ul className="space-y-2">
      {options.map((option) => {
        const share = totalVotes > 0 ? option.votes / totalVotes : 0;
        const winner = option.id === winnerId;
        return (
          <li key={option.id} className="relative overflow-hidden rounded-lg border border-line bg-surface-2 px-3 py-2">
            <span
              aria-hidden
              style={{ width: `${Math.round(share * 100)}%` }}
              className={cn("absolute inset-y-0 left-0", winner ? "bg-gold/20" : "bg-accent/20")}
            />
            <span className="relative flex items-center gap-2 text-sm">
              {winner ? <Crown className="size-4 shrink-0 text-gold" aria-label="Ganadora" /> : null}
              <span className={cn("min-w-0 flex-1 truncate", winner && "font-semibold")}>
                {option.slotName}
                {option.id === highlightId ? <span className="ml-2 text-xs text-accent-text">tu voto</span> : null}
              </span>
              <span className="num text-xs text-muted">
                {formatInteger(option.votes)} · {Math.round(share * 100)}%
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
