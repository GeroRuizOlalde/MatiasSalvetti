import { CalendarDays, Trophy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { LeaderboardRow, PublicRace } from "@/lib/wager";
import { Countdown } from "./countdown";
import { Leaderboard } from "./leaderboard";

const PHASE = {
  upcoming: { label: "Próxima", tone: "next" },
  running: { label: "En curso", tone: "live" },
  ended: { label: "Terminada", tone: "done" },
} as const;

export function RaceView({
  race,
  leaderboard,
  highlightUserId,
}: {
  race: PublicRace;
  leaderboard: LeaderboardRow[];
  highlightUserId?: string | null;
}) {
  const { phase } = race;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-6 rounded-2xl border border-gold/30 bg-[linear-gradient(135deg,rgb(255_201_77/0.08),transparent_60%)] p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill label={PHASE[phase].label} tone={PHASE[phase].tone} />
            {race.casino ? <span className="text-sm text-muted">en {race.casino.name}</span> : null}
          </div>
          <h2 className="font-display text-4xl tracking-wide uppercase">{race.title}</h2>
          <p className="flex items-center gap-2 text-sm text-subtle">
            <CalendarDays className="size-4" aria-hidden /> {formatDateTime(race.starts_at)} →{" "}
            {formatDateTime(race.ends_at)}
          </p>
        </div>
        {phase === "ended" ? null : (
          <Countdown
            target={phase === "upcoming" ? race.starts_at : race.ends_at}
            label={phase === "upcoming" ? "Arranca en" : "Termina en"}
          />
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="ranking-title" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="ranking-title" className="font-display text-3xl tracking-wide uppercase">
              Ranking
            </h2>
            {race.wager_updated_at ? (
              <p className="text-xs text-subtle">Actualizado {formatDateTime(race.wager_updated_at)}</p>
            ) : null}
          </div>
          {leaderboard.length ? (
            <Leaderboard rows={leaderboard} currency={race.currency} highlightUserId={highlightUserId} />
          ) : (
            <EmptyState icon={Trophy} title="Todavía sin wager">
              El ranking se arma con los reportes del casino. Verificá tu cuenta para aparecer.
            </EmptyState>
          )}
        </section>

        <aside className="space-y-4">
          {race.prizes.length ? (
            <section aria-labelledby="prizes-title" className="rounded-2xl border border-line bg-surface p-5">
              <h2 id="prizes-title" className="font-display text-2xl tracking-wide uppercase">
                Premios
              </h2>
              <ol className="mt-3 space-y-1 text-sm">
                {race.prizes.map((prize, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                    <span className="text-muted">{i + 1}.º puesto</span>
                    <span className="num font-semibold text-gold">{formatMoney(prize, race.currency)}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-subtle">
                Total{" "}
                {formatMoney(
                  race.prizes.reduce((a, b) => a + b, 0),
                  race.currency,
                )}
              </p>
            </section>
          ) : null}
          {race.rules_md ? (
            <section className="prose-sm rounded-2xl border border-line bg-surface p-5 text-sm text-muted [&_a]:text-accent-text [&_li]:ml-4 [&_ul]:list-disc">
              <h2 className="mb-2 font-display text-2xl tracking-wide text-text uppercase">Reglas</h2>
              <ReactMarkdown>{race.rules_md}</ReactMarkdown>
            </section>
          ) : null}
          {race.casino ? (
            <a
              href={race.casino.referral_url}
              target="_blank"
              rel="noopener sponsored"
              className="block rounded-2xl border border-line bg-surface p-5 text-sm hover:border-accent/60"
            >
              <span className="text-subtle">Registrate en</span>{" "}
              <span className="font-semibold text-accent-light">{race.casino.name}</span>
              {race.casino.code ? (
                <span className="mt-1 block text-xs text-subtle">
                  Código <span className="num font-semibold text-gold">{race.casino.code}</span>
                </span>
              ) : null}
            </a>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
