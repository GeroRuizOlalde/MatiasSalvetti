import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RaceView } from "@/components/wager/race-view";
import { formatDate } from "@/lib/format";
import { getLeaderboard, getWagerOverview } from "@/lib/wager";
import { MyRaceStatus } from "./my-status";

export const metadata: Metadata = {
  title: "Wager Race",
  description: "El ranking de wager con premios para la comunidad. Verificá tu cuenta de casino y competí.",
};

export default async function WagerRacePage() {
  const { featured, past } = await getWagerOverview();
  const leaderboard = featured ? await getLeaderboard(featured.id) : [];

  return (
    <>
      <PageHeader kicker="competí con la comunidad" title="Wager Race">
        Jugá en el casino de la carrera con tu cuenta verificada: el que más wager suma en el período se lleva el premio
        más grande.
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-12 px-4 pb-16">
        {featured ? (
          <RaceView race={featured} leaderboard={leaderboard} />
        ) : (
          <EmptyState icon={Trophy} title="La próxima carrera se anuncia pronto">
            Mientras tanto, verificá tu cuenta de casino para estar listo cuando arranque.
          </EmptyState>
        )}

        <div className="max-w-xl">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-surface" />}>
            <MyRaceStatus race={featured} leaderboard={leaderboard} />
          </Suspense>
        </div>

        {past.length ? (
          <section aria-labelledby="past-title">
            <h2 id="past-title" className="mb-4 font-display text-3xl tracking-wide uppercase">
              Carreras anteriores
            </h2>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {past.map((race) => (
                <li key={race.id}>
                  <Link
                    href={`/wager-race/${race.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2"
                  >
                    <span className="font-semibold">{race.title}</span>
                    {race.casino ? <span className="text-sm text-subtle">{race.casino.name}</span> : null}
                    <span className="ml-auto text-xs text-subtle">Terminó el {formatDate(race.ends_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
