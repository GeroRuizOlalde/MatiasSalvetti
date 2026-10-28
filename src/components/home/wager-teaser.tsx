import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { CountdownText } from "@/components/wager/countdown-text";
import { cn } from "@/lib/cn";
import { formatMoney, formatMoneyShort } from "@/lib/format";
import type { LeaderboardRow, PublicRace } from "@/lib/wager";

/** Carrera destacada con cuenta regresiva y podio; sin carrera, el anuncio genérico. */
export function WagerTeaser({ race, top }: { race: PublicRace | null; top: LeaderboardRow[] }) {
  const active = race && race.phase !== "ended";
  const total = race?.prizes.reduce((a, b) => a + b, 0) ?? 0;

  return (
    <section aria-labelledby="wager-title" className="mx-auto max-w-7xl px-4">
      <div className="reveal grid gap-8 rounded-3xl border border-line bg-[linear-gradient(135deg,rgb(157_59_255/0.18),transparent_60%)] p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="num text-xs tracking-[0.2em] text-subtle uppercase">
            {active ? (
              <>
                {race.phase === "running" ? "Evento activo · termina en " : "Próximo evento · arranca en "}
                <CountdownText target={race.phase === "running" ? race.ends_at : race.starts_at} />
              </>
            ) : (
              "Competí con la comunidad"
            )}
          </p>
          <h2 id="wager-title" className="mt-2 font-display text-5xl tracking-wide uppercase">
            Wager Race
          </h2>
          <p className="mt-3 max-w-md text-sm text-muted">
            {active && total > 0
              ? `${formatMoney(total, race.currency)} repartidos entre el top ${race.prizes.length}. Jugá con mi link, verificá tu cuenta y sumá en el ranking.`
              : "La próxima carrera se anuncia pronto. Jugá con mi link, verificá tu cuenta y sumá en el ranking."}
          </p>
          <Link href="/wager-race" className={buttonClasses({ size: "sm", className: "mt-5" })}>
            {active ? "Ver ranking completo" : "Ver detalles"}
          </Link>
        </div>
        {active && top.length ? (
          <ol className="space-y-3" aria-label="Podio">
            {top.map((row) => (
              <li
                key={row.user_id}
                className={cn(
                  "lift flex items-center gap-4 rounded-xl border bg-bg/60 px-4 py-3",
                  row.rank === 1 ? "border-gold/50" : "border-line",
                )}
              >
                <span className={cn("font-display text-2xl", row.rank === 1 ? "text-gold" : "text-accent-light")}>
                  #{row.rank}
                </span>
                <span className="num min-w-0 flex-1 truncate text-sm">{row.masked_account}</span>
                <span className="num text-sm font-bold text-gold">
                  {row.prize !== null
                    ? formatMoneyShort(row.prize, race.currency)
                    : formatMoney(row.wager, race.currency)}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
