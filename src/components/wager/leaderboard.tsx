import { openPrizeSpots } from "@/lib/wager-spots";
import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { Medal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/wager";
import type { Enums } from "@/types/database";

const MEDAL = ["text-gold", "text-[#c9d1dd]", "text-[#d08a4f]"];

export function Leaderboard({
  rows,
  currency,
  highlightUserId,
  prizes = [],
  lang = "es",
}: {
  rows: LeaderboardRow[];
  currency: Enums<"currency_code">;
  highlightUserId?: string | null;
  /** Premios de la carrera: los puestos con premio sin nadie se muestran como «Puesto libre». */
  prizes?: number[];
  lang?: Locale;
}) {
  const { t } = getI18n(lang);
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-subtle">
            <th scope="col" className="px-4 py-3 font-semibold">
              #
            </th>
            <th scope="col" className="px-2 py-3 font-semibold">
              {t.wager.player}
            </th>
            <th scope="col" className="px-2 py-3 text-right font-semibold">
              {t.wager.wager}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              {t.wager.prize}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.user_id} className={cn(row.user_id === highlightUserId && "bg-accent/10")}>
              <td className="num px-4 py-3">
                {row.rank <= 3 ? (
                  <Medal className={cn("size-5", MEDAL[row.rank - 1])} aria-label={t.wager.rank(row.rank)} />
                ) : (
                  <span className="text-subtle">{row.rank}</span>
                )}
              </td>
              <td className="px-2 py-3">
                <span className="flex items-center gap-2">
                  <Avatar url={row.avatar_url} name={row.display_name} size={24} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {row.display_name}
                      {row.user_id === highlightUserId ? (
                        <span className="ml-2 text-xs text-accent-text">{t.common.you}</span>
                      ) : null}
                    </span>
                    <span className="num block text-xs text-subtle">{row.masked_account}</span>
                  </span>
                </span>
              </td>
              <td className="num px-2 py-3 text-right whitespace-nowrap">{formatMoney(row.wager, currency)}</td>
              <td className="num px-4 py-3 text-right font-semibold whitespace-nowrap text-gold">
                {row.prize !== null ? formatMoney(row.prize, currency) : "—"}
              </td>
            </tr>
          ))}
          {openPrizeSpots(rows.length, prizes).map((spot) => (
            <tr key={`open-${spot.rank}`} className="text-subtle">
              <td className="num px-4 py-3">
                {spot.rank <= 3 ? (
                  <Medal
                    className={cn("size-5 opacity-50", MEDAL[spot.rank - 1])}
                    aria-label={t.wager.rank(spot.rank)}
                  />
                ) : (
                  <span>{spot.rank}</span>
                )}
              </td>
              <td className="px-2 py-3 italic">{t.wager.openSpot}</td>
              <td className="num px-2 py-3 text-right">—</td>
              <td className="num px-4 py-3 text-right font-semibold whitespace-nowrap text-gold/70">
                {formatMoney(spot.prize, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
