import { CasinosSection } from "@/components/home/casinos-section";
import { ClipsSection } from "@/components/home/clips-section";
import { CommunitySection } from "@/components/home/community-section";
import { Hero } from "@/components/home/hero";
import { EMPTY_SESSIONS, Sessions } from "@/components/home/sessions";
import { StatsStrip, type Stat } from "@/components/home/stats-strip";
import { WagerTeaser } from "@/components/home/wager-teaser";
import { getActiveCasinos } from "@/lib/casinos";
import { getLatestVideos } from "@/lib/external/youtube";
import { formatInteger, formatMoney } from "@/lib/format";
import { getLiveStatus } from "@/lib/live-status";
import { getPublicSettings, type PublicSettings } from "@/lib/settings";

function buildStats(settings: PublicSettings): Stat[] {
  const { years_streaming, monthly_prizes } = settings.home_stats;
  const stats: (Stat | null)[] = [
    years_streaming !== null ? { label: "Años en stream", value: formatInteger(years_streaming) } : null,
    // Hunts abiertos y mejor multiplicador salen de la base a partir de la fase 3.
    monthly_prizes !== null ? { label: "Premios del mes", value: formatMoney(monthly_prizes) } : null,
  ];
  return stats.filter((s): s is Stat => s !== null);
}

export default async function HomePage() {
  const [settings, live, casinos, videos] = await Promise.all([
    getPublicSettings(),
    getLiveStatus(),
    getActiveCasinos(),
    getLatestVideos(3),
  ]);

  return (
    <>
      <Hero settings={settings} live={live} />
      <StatsStrip stats={buildStats(settings)} />
      <Sessions cards={EMPTY_SESSIONS} />
      <WagerTeaser />
      <CasinosSection casinos={casinos} />
      <ClipsSection videos={videos} channelUrl={settings.socials.youtube} />
      <CommunitySection socials={settings.socials} />
    </>
  );
}
