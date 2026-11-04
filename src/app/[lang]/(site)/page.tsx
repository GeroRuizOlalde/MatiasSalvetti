import { JsonLd } from "@/components/json-ld";
import { ClipsSection } from "@/components/home/clips-section";
import { CommunitySection } from "@/components/home/community-section";
import { Hero } from "@/components/home/hero";
import { PartnerSection } from "@/components/home/partner-section";
import { emptySessions, Sessions, type SessionCard } from "@/components/home/sessions";
import { StatsStrip, type Stat } from "@/components/home/stats-strip";
import { WagerTeaser } from "@/components/home/wager-teaser";
import { getActiveCasinos } from "@/lib/casinos";
import { publicEnv } from "@/lib/env";
import { getPublicBattles, type BattleSummary } from "@/lib/battles";
import { getPublicBuySessions, type BuySessionSummary } from "@/lib/buys";
import { buysStats } from "@/lib/calc/buys";
import { huntStats } from "@/lib/calc/hunt";
import { formatDayMonth, formatInteger, formatMoneyShort, formatMulti } from "@/lib/format";
import { isHuntActive } from "@/lib/hunt-status";
import { getHuntRecords, getPublicHunts, type HuntSummary } from "@/lib/hunts";
import { getLiveStatus } from "@/lib/live-status";
import { getOfflineHighlight } from "@/lib/offline-highlight";
import { getPublicSettings, type PublicSettings } from "@/lib/settings";
import { getLeaderboard, getWagerOverview } from "@/lib/wager";
import { spotsToShow } from "@/lib/wager-spots";
import { getLatestVideos } from "@/lib/external/youtube";
import { isLocale, type Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { Messages } from "@/i18n/messages";

function buildStats(
  t: Messages,
  settings: PublicSettings,
  records: { bestMulti: number | null },
  openHunts: number,
): Stat[] {
  const { years_streaming, monthly_prizes } = settings.home_stats;
  const s = t.home.stats;
  const stats: (Stat | null)[] = [
    years_streaming !== null ? { label: s.years, value: formatInteger(years_streaming) } : null,
    { label: s.openHunts(openHunts), value: formatInteger(openHunts) },
    records.bestMulti !== null ? { label: s.bestMulti, value: formatMulti(records.bestMulti) } : null,
    monthly_prizes !== null
      ? { label: s.monthlyPrizes, value: formatMoneyShort(monthly_prizes), highlight: true }
      : null,
  ];
  return stats.filter((s): s is Stat => s !== null);
}

type CardData = Pick<SessionCard, "href" | "status" | "facts" | "meta">;

function huntCard(lang: Locale, hunt: HuntSummary): CardData {
  const { t, href } = getI18n(lang);
  const stats = huntStats(hunt.start_cost, hunt.bonuses, hunt.opening_balance);
  const active = isHuntActive(hunt.status);
  return {
    href: href(`/bonus-hunt/${hunt.id}`),
    status: { label: active ? t.home.sessions.running : t.home.sessions.last, tone: active ? "live" : "past" },
    meta: formatDayMonth(hunt.created_at, lang),
    facts: [
      { label: t.home.sessions.bonuses, value: `${formatInteger(stats.opened)}/${formatInteger(stats.bonuses)}` },
      {
        label: t.home.sessions.breakEven,
        value: stats.breakEvenMulti !== null ? formatMulti(stats.breakEvenMulti) : "—",
      },
    ],
  };
}

function buysCard(lang: Locale, session: BuySessionSummary): CardData {
  const { t, href } = getI18n(lang);
  const stats = buysStats(session.buys);
  const live = session.status === "live";
  return {
    href: href(`/bonus-buys/${session.id}`),
    status: { label: live ? t.home.sessions.running : t.home.sessions.last, tone: live ? "live" : "past" },
    meta: formatDayMonth(session.created_at, lang),
    facts: [
      { label: t.home.sessions.buys, value: formatInteger(stats.buys) },
      { label: t.home.sessions.bestX, value: stats.best ? formatMulti(stats.best.multi) : "—" },
    ],
  };
}

function battleCard(lang: Locale, battle: BattleSummary): CardData {
  const { t, href } = getI18n(lang);
  const champion = battle.entries.find((e) => e.id === battle.winner_entry_id);
  const STATUS = {
    draft: { label: t.home.sessions.upcoming, tone: "next" },
    open: { label: t.home.sessions.upcoming, tone: "next" },
    live: { label: t.home.sessions.running, tone: "live" },
    finished: { label: t.home.sessions.last, tone: "past" },
  } as const;
  return {
    href: href(`/bonus-battle/${battle.id}`),
    status: STATUS[battle.status],
    meta: formatDayMonth(battle.created_at, lang),
    facts: [
      { label: t.home.sessions.slots, value: formatInteger(battle.entries.length) },
      { label: t.home.sessions.champion, value: champion?.slot_name ?? "—" },
    ],
  };
}

/** Cada tarjeta muestra la sesión en curso o, si no hay, la última. */
function buildSessions(
  lang: Locale,
  hunt?: HuntSummary,
  buys?: BuySessionSummary,
  battle?: BattleSummary,
): SessionCard[] {
  const data: Partial<Record<SessionCard["key"], CardData>> = {
    hunt: hunt && huntCard(lang, hunt),
    buys: buys && buysCard(lang, buys),
    battle: battle && battleCard(lang, battle),
  };
  return emptySessions(lang).map((s) => ({ ...s, ...data[s.key] }));
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang: param } = await params;
  const lang: Locale = isLocale(param) ? param : "es";
  const { t } = getI18n(lang);
  const [settings, live, casinos, hunts, records, buySessions, battles, wager, videos, offline] = await Promise.all([
    getPublicSettings(),
    getLiveStatus(),
    getActiveCasinos(),
    getPublicHunts(),
    getHuntRecords(),
    getPublicBuySessions(),
    getPublicBattles(),
    getWagerOverview(),
    getLatestVideos(3),
    getOfflineHighlight(),
  ]);
  const race = wager.featured && wager.featured.phase !== "ended" ? wager.featured : null;
  // En la home, tantos puestos como premios (mínimo 3, máximo 10).
  const top = race ? await getLeaderboard(race.id, spotsToShow(race.prizes, 3, 10)) : [];
  const raceTotal = race?.prizes.reduce((a, b) => a + b, 0) ?? 0;
  const activeHunt = hunts.find((h) => isHuntActive(h.status));
  const partnerCasino = casinos.find((c) => c.slug === settings.partner.casino_slug);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: "Chupetti",
              url: publicEnv.NEXT_PUBLIC_SITE_URL,
              inLanguage: lang === "en" ? "en" : "es-AR",
            },
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
        lang={lang}
        settings={settings}
        live={live}
        extras={{
          wagerPrize: race && raceTotal > 0 ? formatMoneyShort(raceTotal, race.currency) : null,
          activeHunt: activeHunt ? { title: activeHunt.title, status: t.status.hunt[activeHunt.status] } : null,
          offline,
        }}
      />
      <StatsStrip
        label={t.home.stats.label}
        stats={buildStats(t, settings, records, hunts.filter((h) => isHuntActive(h.status)).length)}
      />
      {partnerCasino ? <PartnerSection lang={lang} casino={partnerCasino} partner={settings.partner} /> : null}
      <Sessions lang={lang} cards={buildSessions(lang, hunts[0], buySessions[0], battles[0])} />
      <WagerTeaser lang={lang} race={wager.featured} top={top} />
      <ClipsSection lang={lang} videos={videos} channelUrl={settings.socials.youtube} />
      <CommunitySection lang={lang} socials={settings.socials} />
    </>
  );
}
