import { CasinosSection } from "@/components/home/casinos-section";
import { ClipsSection } from "@/components/home/clips-section";
import { CommunitySection } from "@/components/home/community-section";
import { Hero } from "@/components/home/hero";
import { EMPTY_SESSIONS, Sessions, type SessionCard } from "@/components/home/sessions";
import { StatsStrip, type Stat } from "@/components/home/stats-strip";
import { WagerTeaser } from "@/components/home/wager-teaser";
import { getActiveCasinos } from "@/lib/casinos";
import { getLatestVideos } from "@/lib/external/youtube";
import { huntStats } from "@/lib/calc/hunt";
import { formatInteger, formatMoney, formatMulti } from "@/lib/format";
import { HUNT_STATUS_LABEL, isHuntActive } from "@/lib/hunt-status";
import { getHuntRecords, getPublicHunts, type HuntSummary } from "@/lib/hunts";
import { getLiveStatus } from "@/lib/live-status";
import { getPublicSettings, type PublicSettings } from "@/lib/settings";

function buildStats(settings: PublicSettings, records: { hunts: number; bestMulti: number | null }): Stat[] {
  const { years_streaming, monthly_prizes } = settings.home_stats;
  const stats: (Stat | null)[] = [
    years_streaming !== null ? { label: "Años en stream", value: formatInteger(years_streaming) } : null,
    records.hunts > 0 ? { label: "Bonus hunts", value: formatInteger(records.hunts) } : null,
    records.bestMulti !== null ? { label: "Mejor multiplicador", value: formatMulti(records.bestMulti) } : null,
    monthly_prizes !== null ? { label: "Premios del mes", value: formatMoney(monthly_prizes) } : null,
  ];
  return stats.filter((s): s is Stat => s !== null);
}

/** La tarjeta del hunt muestra el que está en curso o, si no hay, el último. */
function buildSessions(hunt: HuntSummary | undefined): SessionCard[] {
  if (!hunt) return EMPTY_SESSIONS;
  const stats = huntStats(hunt.start_cost, hunt.bonuses);
  const active = isHuntActive(hunt.status);
  const card: Partial<SessionCard> = {
    href: `/bonus-hunt/${hunt.id}`,
    status: { label: active ? HUNT_STATUS_LABEL[hunt.status] : "Último hunt", tone: active ? "live" : "past" },
    facts: [
      { label: "Bonos", value: `${formatInteger(stats.opened)}/${formatInteger(stats.bonuses)}` },
      {
        label: hunt.final_balance !== null ? "Balance final" : "Inversión",
        value: formatMoney(hunt.final_balance ?? hunt.start_cost, hunt.currency),
      },
    ],
  };
  return EMPTY_SESSIONS.map((s) => (s.key === "hunt" ? { ...s, ...card } : s));
}

export default async function HomePage() {
  const [settings, live, casinos, videos, hunts, records] = await Promise.all([
    getPublicSettings(),
    getLiveStatus(),
    getActiveCasinos(),
    getLatestVideos(3),
    getPublicHunts(),
    getHuntRecords(),
  ]);

  return (
    <>
      <Hero settings={settings} live={live} />
      <StatsStrip stats={buildStats(settings, records)} />
      <Sessions cards={buildSessions(hunts[0])} />
      <WagerTeaser />
      <CasinosSection casinos={casinos} />
      <ClipsSection videos={videos} channelUrl={settings.socials.youtube} />
      <CommunitySection socials={settings.socials} />
    </>
  );
}
