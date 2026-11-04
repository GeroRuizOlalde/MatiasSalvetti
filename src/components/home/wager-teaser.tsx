import { openPrizeSpots, spotsToShow } from "@/lib/wager-spots";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { CountdownText } from "@/components/wager/countdown-text";
import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { formatMoney, formatMoneyShort } from "@/lib/format";
import type { LeaderboardRow, PublicRace } from "@/lib/wager";

/** Carrera destacada con cuenta regresiva y podio; sin carrera, el anuncio genérico. */
export function WagerTeaser({ race, top, lang }: { race: PublicRace | null; top: LeaderboardRow[]; lang: Locale }) {
  const { t, href } = getI18n(lang);
  const w = t.home.wager;
  const active = race && race.phase !== "ended";
  const total = race?.prizes.reduce((a, b) => a + b, 0) ?? 0;

  return (
    <section aria-labelledby="wager-title" className="mx-auto max-w-7xl px-4">
      <div className="reveal grid gap-8 rounded-3xl border border-line bg-[linear-gradient(135deg,rgb(157_59_255/0.18),transparent_60%)] p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="num text-xs tracking-[0.2em] text-subtle uppercase">
            {active ? (
              <>
                {race.phase === "running" ? w.running : w.upcoming}
                <CountdownText target={race.phase === "running" ? race.ends_at : race.starts_at} />
              </>
            ) : (
              w.compete
            )}
          </p>
          <h2 id="wager-title" className="mt-2 font-display text-5xl tracking-wide uppercase">
            Wager Race
          </h2>
          <p className="mt-3 max-w-md text-sm text-muted">
            {active && total > 0 ? w.prizes(formatMoney(total, race.currency), race.prizes.length) : w.soon}
          </p>
          <Link href={href("/wager-race")} className={buttonClasses({ size: "sm", className: "mt-5" })}>
            {active ? w.fullRanking : w.details}
          </Link>
        </div>
        {active && (top.length || race.prizes.length) ? (
          <ol className="space-y-3" aria-label={w.podium}>
            {top.map((row) => (
              <li
                key={row.user_id}
                className={cn(
                  "lift flex items-center gap-4 rounded-xl border bg-bg/60 px-4 py-3",
                  row.rank === 1 ? "border-gold/50" : "border-line",
                )}
              >
                <span className={cn("font-display text-2xl", row.rank === 1 ? "text-gold" : "text-accent-light")}>
                  #{row.rank}
                </span>
                <span className="num min-w-0 flex-1 truncate text-sm">{row.masked_account}</span>
                <span className="num text-sm font-bold text-gold">
                  {row.prize !== null
                    ? formatMoneyShort(row.prize, race.currency)
                    : formatMoney(row.wager, race.currency)}
                </span>
              </li>
            ))}
            {openPrizeSpots(top.length, race.prizes, spotsToShow(race.prizes, 3, 10)).map((spot) => (
              <li
                key={`open-${spot.rank}`}
                className="flex items-center gap-4 rounded-xl border border-dashed border-line bg-bg/40 px-4 py-3"
              >
                <span className="font-display text-2xl text-subtle">#{spot.rank}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-subtle italic">{t.wager.openSpot}</span>
                <span className="num text-sm font-bold text-gold/70">
                  {formatMoneyShort(spot.prize, race.currency)}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
