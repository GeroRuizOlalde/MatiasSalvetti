import { JsonLd } from "@/components/json-ld";
import { ClipsSection } from "@/components/home/clips-section";
import { CommunitySection } from "@/components/home/community-section";
import { Hero } from "@/components/home/hero";
import { PartnerSection } from "@/components/home/partner-section";
import { EMPTY_SESSIONS, Sessions, type SessionCard } from "@/components/home/sessions";
import { StatsStrip, type Stat } from "@/components/home/stats-strip";
import { WagerTeaser } from "@/components/home/wager-teaser";
import { getActiveCasinos } from "@/lib/casinos";
import { publicEnv } from "@/lib/env";
import { getPublicBattles, type BattleSummary } from "@/lib/battles";
import { getPublicBuySessions, type BuySessionSummary } from "@/lib/buys";
import { buysStats } from "@/lib/calc/buys";
import { huntStats } from "@/lib/calc/hunt";
import { formatDayMonth, formatInteger, formatMoneyShort, formatMulti } from "@/lib/format";
import { HUNT_STATUS_LABEL, isHuntActive } from "@/lib/hunt-status";
import { getHuntRecords, getPublicHunts, type HuntSummary } from "@/lib/hunts";
import { getLiveStatus } from "@/lib/live-status";
import { getPublicSettings, type PublicSettings } from "@/lib/settings";
import { getLeaderboard, getWagerOverview } from "@/lib/wager";
import { getLatestVideos } from "@/lib/external/youtube";

function buildStats(settings: PublicSettings, records: { bestMulti: number | null }, openHunts: number): Stat[] {
  const { years_streaming, monthly_prizes } = settings.home_stats;
  const stats: (Stat | null)[] = [
    years_streaming !== null ? { label: "años en stream", value: formatInteger(years_streaming) } : null,
    { label: openHunts === 1 ? "bonus hunt abierto" : "bonus hunts abiertos", value: formatInteger(openHunts) },
    records.bestMulti !== null ? { label: "mejor multiplicador", value: formatMulti(records.bestMulti) } : null,
    monthly_prizes !== null
      ? { label: "en premios este mes", value: formatMoneyShort(monthly_prizes), highlight: true }
      : null,
  ];
  return stats.filter((s): s is Stat => s !== null);
}

type CardData = Pick<SessionCard, "href" | "status" | "facts" | "meta">;

function huntCard(hunt: HuntSummary): CardData {
  const stats = huntStats(hunt.start_cost, hunt.bonuses);
  const active = isHuntActive(hunt.status);
  return {
    href: `/bonus-hunt/${hunt.id}`,
    status: { label: active ? "En curso" : "Última sesión", tone: active ? "live" : "past" },
    meta: formatDayMonth(hunt.created_at),
    facts: [
      { label: "Bonos", value: `${formatInteger(stats.opened)}/${formatInteger(stats.bonuses)}` },
      {
        label: "Break-even",
        value: stats.breakEvenMulti !== null ? formatMulti(stats.breakEvenMulti) : "—",
      },
    ],
  };
}

function buysCard(session: BuySessionSummary): CardData {
  const stats = buysStats(session.buys);
  const live = session.status === "live";
  return {
    href: `/bonus-buys/${session.id}`,
    status: { label: live ? "En curso" : "Última sesión", tone: live ? "live" : "past" },
    meta: formatDayMonth(session.created_at),
    facts: [
      { label: "Compras", value: formatInteger(stats.buys) },
      { label: "Mejor x", value: stats.best ? formatMulti(stats.best.multi) : "—" },
    ],
  };
}

function battleCard(battle: BattleSummary): CardData {
  const champion = battle.entries.find((e) => e.id === battle.winner_entry_id);
  const STATUS = {
    draft: { label: "Próxima", tone: "next" },
    open: { label: "Próxima", tone: "next" },
    live: { label: "En curso", tone: "live" },
    finished: { label: "Última sesión", tone: "past" },
  } as const;
  return {
    href: `/bonus-battle/${battle.id}`,
    status: STATUS[battle.status],
    meta: formatDayMonth(battle.created_at),
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
  const [settings, live, casinos, hunts, records, buySessions, battles, wager, videos] = await Promise.all([
    getPublicSettings(),
    getLiveStatus(),
    getActiveCasinos(),
    getPublicHunts(),
    getHuntRecords(),
    getPublicBuySessions(),
    getPublicBattles(),
    getWagerOverview(),
    getLatestVideos(3),
  ]);
  const race = wager.featured && wager.featured.phase !== "ended" ? wager.featured : null;
  const top = race ? await getLeaderboard(race.id, 3) : [];
  const raceTotal = race?.prizes.reduce((a, b) => a + b, 0) ?? 0;
  const activeHunt = hunts.find((h) => isHuntActive(h.status));
  const partnerCasino = casinos.find((c) => c.slug === settings.partner.casino_slug);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite", name: "Chupetti", url: publicEnv.NEXT_PUBLIC_SITE_URL, inLanguage: "es-AR" },
            {
              "@type": "Person",
              name: "Chupetti",
              url: publicEnv.NEXT_PUBLIC_SITE_URL,
              sameAs: Object.values(settings.socials),
            },
          ],
        }}
      />
      <Hero
        settings={settings}
        live={live}
        extras={{
          wagerPrize: race && raceTotal > 0 ? formatMoneyShort(raceTotal, race.currency) : null,
          activeHunt: activeHunt ? { title: activeHunt.title, status: HUNT_STATUS_LABEL[activeHunt.status] } : null,
        }}
      />
      <StatsStrip stats={buildStats(settings, records, hunts.filter((h) => isHuntActive(h.status)).length)} />
      {partnerCasino ? <PartnerSection casino={partnerCasino} partner={settings.partner} /> : null}
      <Sessions cards={buildSessions(hunts[0], buySessions[0], battles[0])} />
      <WagerTeaser race={wager.featured} top={top} />
      <ClipsSection videos={videos} channelUrl={settings.socials.youtube} />
      <CommunitySection socials={settings.socials} />
    </>
  );
}
