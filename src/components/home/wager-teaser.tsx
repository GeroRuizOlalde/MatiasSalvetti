import { Medal, Trophy } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Countdown } from "@/components/wager/countdown";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { LeaderboardRow, PublicRace } from "@/lib/wager";
import { SectionHeading } from "./section-heading";

const MEDAL = ["text-gold", "text-[#c9d1dd]", "text-[#d08a4f]"];

/** Carrera destacada con cuenta regresiva y podio; sin carrera, el anuncio genérico. */
export function WagerTeaser({ race, top }: { race: PublicRace | null; top: LeaderboardRow[] }) {
  const active = race && race.phase !== "ended";

  return (
    <section aria-labelledby="wager-title" className="border-y border-line bg-bg-alt">
      <div className="mx-auto max-w-7xl px-4 py-16">
        <SectionHeading id="wager-title" kicker="competí con la comunidad" title="Wager Race" />
        <div className="flex flex-col gap-6 rounded-2xl border border-gold/30 bg-[linear-gradient(135deg,rgb(255_201_77/0.08),transparent_60%)] p-6 sm:p-8 lg:flex-row lg:items-center">
          <Trophy className="size-12 shrink-0 text-gold" aria-hidden />
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-display text-2xl tracking-wide uppercase">
                {active ? race.title : "La próxima carrera se anuncia pronto"}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {active && race.prizes.length
                  ? `${formatMoney(
                      race.prizes.reduce((a, b) => a + b, 0),
                      race.currency,
                    )} en premios${race.casino ? ` en ${race.casino.name}` : ""}.`
                  : "Jugá en los casinos de la comunidad, verificá tu cuenta y sumá wager para quedar en el podio."}
              </p>
            </div>
            {active ? (
              <Countdown
                target={race.phase === "upcoming" ? race.starts_at : race.ends_at}
                label={race.phase === "upcoming" ? "Arranca en" : "Termina en"}
              />
            ) : null}
          </div>
          {active && top.length ? (
            <ol className="w-full space-y-2 lg:w-72" aria-label="Podio">
              {top.map((row) => (
                <li key={row.user_id} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2 text-sm">
                  <Medal className={cn("size-5 shrink-0", MEDAL[row.rank - 1])} aria-label={`Puesto ${row.rank}`} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{row.display_name}</span>
                  <span className="num text-xs text-muted">{formatMoney(row.wager, race.currency)}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <Link
            href="/wager-race"
            className={buttonClasses({ variant: "secondary", className: "self-start lg:self-center" })}
          >
            {active ? "Ver ranking" : "Ver detalles"}
          </Link>
        </div>
      </div>
    </section>
  );
}
