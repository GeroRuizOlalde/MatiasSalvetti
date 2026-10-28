import { CasinosSection } from "@/components/home/casinos-section";
import { JsonLd } from "@/components/json-ld";
import { ClipsSection } from "@/components/home/clips-section";
import { CommunitySection } from "@/components/home/community-section";
import { Hero } from "@/components/home/hero";
import { EMPTY_SESSIONS, Sessions, type SessionCard } from "@/components/home/sessions";
import { StatsStrip, type Stat } from "@/components/home/stats-strip";
import { WagerTeaser } from "@/components/home/wager-teaser";
import { getActiveCasinos } from "@/lib/casinos";
import { publicEnv } from "@/lib/env";
import { getLatestVideos } from "@/lib/external/youtube";
import { getPublicBattles, type BattleSummary } from "@/lib/battles";
import { getPublicBuySessions, type BuySessionSummary } from "@/lib/buys";
import { buysStats } from "@/lib/calc/buys";
import { huntStats } from "@/lib/calc/hunt";
import { formatInteger, formatMoney, formatMulti } from "@/lib/format";
import { HUNT_STATUS_LABEL, isHuntActive } from "@/lib/hunt-status";
import { getHuntRecords, getPublicHunts, type HuntSummary } from "@/lib/hunts";
import { getLiveStatus } from "@/lib/live-status";
import { BATTLE_STATUSES, statusInfo } from "@/lib/session-status";
import { getPublicSettings, type PublicSettings } from "@/lib/settings";
import { getLeaderboard, getWagerOverview } from "@/lib/wager";

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

type CardData = Pick<SessionCard, "href" | "status" | "facts">;

function huntCard(hunt: HuntSummary): CardData {
  const stats = huntStats(hunt.start_cost, hunt.bonuses);
  const active = isHuntActive(hunt.status);
  return {
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
}

function buysCard(session: BuySessionSummary): CardData {
  const stats = buysStats(session.buys);
  const live = session.status === "live";
  return {
    href: `/bonus-buys/${session.id}`,
    status: { label: live ? "En vivo" : "Última sesión", tone: live ? "live" : "past" },
    facts: [
      { label: "Compras", value: formatInteger(stats.buys) },
      { label: "Mejor multi", value: stats.best ? formatMulti(stats.best.multi) : "—" },
    ],
  };
}

function battleCard(battle: BattleSummary): CardData {
  const champion = battle.entries.find((e) => e.id === battle.winner_entry_id);
  const status = statusInfo(BATTLE_STATUSES, battle.status);
  return {
    href: `/bonus-battle/${battle.id}`,
    status: {
      label: battle.status === "finished" ? "Última battle" : status.label,
      tone: battle.status === "live" ? "live" : battle.status === "open" ? "next" : "past",
    },
    facts: [
      { label: "Slots", value: formatInteger(battle.entries.length) },
      { label: "Campeón", value: champion?.slot_name ?? "—" },
    ],
  };
}

/** Cada tarjeta muestra la sesión en curso o, si no hay, la última. */
function buildSessions(hunt?: HuntSummary, buys?: BuySessionSummary, battle?: BattleSummary): SessionCard[] {
  const data: Partial<Record<SessionCard["key"], CardData>> = {
    hunt: hunt && huntCard(hunt),
    buys: buys && buysCard(buys),
    battle: battle && battleCard(battle),
  };
  return EMPTY_SESSIONS.map((s) => ({ ...s, ...data[s.key] }));
}

export default async function HomePage() {
  const [settings, live, casinos, videos, hunts, records, buySessions, battles, wager] = await Promise.all([
    getPublicSettings(),
    getLiveStatus(),
    getActiveCasinos(),
    getLatestVideos(3),
    getPublicHunts(),
    getHuntRecords(),
    getPublicBuySessions(),
    getPublicBattles(),
    getWagerOverview(),
  ]);
  const top = wager.featured && wager.featured.phase !== "ended" ? await getLeaderboard(wager.featured.id, 3) : [];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: "Matías Salvetti · Chupetti",
              url: publicEnv.NEXT_PUBLIC_SITE_URL,
              inLanguage: "es-AR",
            },
            {
              "@type": "Person",
              name: "Matías Salvetti",
              alternateName: "Chupetti",
              url: publicEnv.NEXT_PUBLIC_SITE_URL,
              sameAs: Object.values(settings.socials),
            },
          ],
        }}
      />
      <Hero settings={settings} live={live} />
      <StatsStrip stats={buildStats(settings, records)} />
      <Sessions cards={buildSessions(hunts[0], buySessions[0], battles[0])} />
      <WagerTeaser race={wager.featured} top={top} />
      <CasinosSection casinos={casinos} />
      <ClipsSection videos={videos} channelUrl={settings.socials.youtube} />
      <CommunitySection socials={settings.socials} />
    </>
  );
}
