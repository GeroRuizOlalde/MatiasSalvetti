import { getI18n, pageLocale } from "@/i18n/server";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RaceView } from "@/components/wager/race-view";
import { getLeaderboard, getPublicRace } from "@/lib/wager";

export async function generateMetadata({ params }: PageProps<"/[lang]/wager-race/[id]">): Promise<Metadata> {
  const { id } = await params;
  const race = await getPublicRace(id);
  return { title: race ? `${race.title} · Wager Race` : "Wager Race" };
}

export default function RacePage({ params }: PageProps<"/[lang]/wager-race/[id]">) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-16">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface" />}>
        <RaceDetail params={params} />
      </Suspense>
    </div>
  );
}

async function RaceDetail({ params }: Pick<PageProps<"/[lang]/wager-race/[id]">, "params">) {
  const [{ id }, lang] = await Promise.all([params, pageLocale(params)]);
  const race = await getPublicRace(id);
  if (!race) notFound();
  const leaderboard = await getLeaderboard(race.id);
  return (
    <>
      <Link
        href={getI18n(lang).href("/wager-race")}
        className="mb-6 flex items-center gap-1 text-sm text-subtle hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Wager Race
      </Link>
      <RaceView race={race} leaderboard={leaderboard} lang={lang} />
    </>
  );
}
