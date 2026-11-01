import { getI18n, pageLocale } from "@/i18n/server";
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

export async function generateMetadata({ params }: PageProps<"/[lang]/wager-race">): Promise<Metadata> {
  const { t } = getI18n(await pageLocale(params));
  return { title: "Wager Race", description: t.wagerPage.metaDescription };
}

export default async function WagerRacePage({ params }: PageProps<"/[lang]/wager-race">) {
  const lang = await pageLocale(params);
  const { t, href } = getI18n(lang);
  const { featured, past } = await getWagerOverview();
  const leaderboard = featured ? await getLeaderboard(featured.id) : [];

  return (
    <>
      <PageHeader kicker={t.wagerPage.kicker} title="Wager Race">
        {t.wagerPage.intro}
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-12 px-4 pb-16">
        {featured ? (
          <RaceView race={featured} leaderboard={leaderboard} lang={lang} />
        ) : (
          <EmptyState icon={Trophy} title={t.wagerPage.emptyTitle}>
            {t.wagerPage.empty}
          </EmptyState>
        )}

        <div className="max-w-xl">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-surface" />}>
            <MyRaceStatus race={featured} leaderboard={leaderboard} lang={lang} />
          </Suspense>
        </div>

        {past.length ? (
          <section aria-labelledby="past-title">
            <h2 id="past-title" className="mb-4 font-display text-3xl tracking-wide uppercase">
              {t.wagerPage.past}
            </h2>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {past.map((race) => (
                <li key={race.id}>
                  <Link
                    href={href(`/wager-race/${race.id}`)}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2"
                  >
                    <span className="font-semibold">{race.title}</span>
                    {race.casino ? <span className="text-sm text-subtle">{race.casino.name}</span> : null}
                    <span className="ml-auto text-xs text-subtle">
                      {t.wagerPage.endedOn(formatDate(race.ends_at, lang))}
                    </span>
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
