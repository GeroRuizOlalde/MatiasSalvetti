import { cn } from "@/lib/cn";
import { formatMoney, formatMulti } from "@/lib/format";
import type { Enums } from "@/types/database";

/** Bonos a la vista: el resto va pasando solo para que el overlay ocupe poco. */
const VISIBLE = 3;
/** Segundos que tarda cada bono en pasar. */
const SECONDS_PER_ROW = 2.5;

type Bonus = { id: string; slot_name: string; bet: number; payout: number | null; multi: number | null };

/** Lista de bonos del overlay: muestra 3 y va subiendo en loop. Con 3 o menos queda quieta. */
export function BonusTicker({
  bonuses,
  currency,
  nextIndex,
  bestIndex,
}: {
  bonuses: Bonus[];
  currency: Enums<"currency_code">;
  nextIndex: number;
  bestIndex: number | null;
}) {
  const scrolls = bonuses.length > VISIBLE;
  // Para que el loop no tenga salto, la lista va dos veces y se desplaza la mitad.
  const copies = scrolls ? [0, 1] : [0];

  return (
    // Cada fila mide 2.25rem (h-8 + pb-1), así la ventana muestra justo VISIBLE filas.
    <div
      className={cn(
        "overflow-hidden",
        // Desvanecido arriba y abajo para que las filas entren y salgan suave.
        scrolls && "[mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]",
      )}
      style={{ height: `${Math.min(VISIBLE, bonuses.length) * 2.25}rem` }}
    >
      <ol
        className={scrolls ? "animate-ticker-up" : undefined}
        style={scrolls ? { animationDuration: `${bonuses.length * SECONDS_PER_ROW}s` } : undefined}
      >
        {copies.flatMap((copy) =>
          bonuses.map((bonus, index) => {
            const isNext = index === nextIndex;
            return (
              <li key={`${copy}-${bonus.id}`} aria-hidden={copy === 1 || undefined} className="pb-1">
                <div
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-lg px-2 text-sm",
                    isNext ? "bg-accent/30 ring-1 ring-accent ring-inset" : "bg-white/5",
                    bonus.payout === null && !isNext && "text-muted",
                  )}
                >
                  <span className="num w-6 text-xs text-subtle">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{bonus.slot_name}</span>
                  <span className="num w-20 text-right text-xs text-muted">{formatMoney(bonus.bet, currency)}</span>
                  <span
                    className={cn(
                      "num w-20 text-right font-bold",
                      bestIndex === index ? "text-gold" : "text-accent-light",
                    )}
                  >
                    {bonus.multi !== null ? formatMulti(bonus.multi) : isNext ? "▶" : ""}
                  </span>
                </div>
              </li>
            );
          }),
        )}
      </ol>
    </div>
  );
}
