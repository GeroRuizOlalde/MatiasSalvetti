import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { BadgeCheck, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { ParticipationGate, ParticipationTitle, participationBox } from "@/components/participation-gate";
import { getActiveCasinos } from "@/lib/casinos";
import { formatMoney, maskAccountId } from "@/lib/format";
import type { LeaderboardRow, PublicRace } from "@/lib/wager";
import { createClient } from "@/lib/supabase/server";

const STATUS = {
  pending: { icon: Clock, className: "text-gold" },
  approved: { icon: BadgeCheck, className: "text-emerald-400" },
  rejected: { icon: XCircle, className: "text-live" },
} as const;

/**
 * Lee la sesión: va dentro de un <Suspense>. Estado de verificación del viewer y su puesto.
 * La verificación se hace desde Mi perfil.
 */
export function MyRaceStatus({
  race,
  leaderboard,
  lang,
}: {
  race: PublicRace | null;
  leaderboard: LeaderboardRow[];
  lang: Locale;
}) {
  const { t, href } = getI18n(lang);
  const w = t.wagerPage;
  return (
    <ParticipationGate next="/wager-race" title={w.verification} loginHint={w.loginHint} lang={lang}>
      {async (profile) => {
        const supabase = await createClient();
        const [{ data: accounts }, casinos] = await Promise.all([
          supabase
            .from("casino_accounts")
            .select("id, casino_id, account_id, status, reject_reason")
            .eq("user_id", profile.id),
          getActiveCasinos(),
        ]);
        const mine = leaderboard.find((row) => row.user_id === profile.id);
        const done = new Set((accounts ?? []).filter((a) => a.status !== "rejected").map((a) => a.casino_id));
        const raceCasino = race ? casinos.find((c) => c.slug === race.casino?.slug) : undefined;
        const hasRaceAccount = raceCasino ? done.has(raceCasino.id) : done.size > 0;

        return (
          <section className={`${participationBox} space-y-5`}>
            <ParticipationTitle>{w.yourAccount}</ParticipationTitle>
            {race && mine ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                {w.youAre} <strong className="num text-gold">{w.ordinal(mine.rank)}</strong> {w.with}{" "}
                <span className="num">{formatMoney(mine.wager, race.currency)}</span> {w.ofWager}
              </p>
            ) : null}
            {accounts?.length ? (
              <ul className="space-y-2 text-sm">
                {accounts.map((account) => {
                  const status = STATUS[account.status];
                  const casino = casinos.find((c) => c.id === account.casino_id);
                  return (
                    <li key={account.id} className="rounded-lg bg-surface-2 px-3 py-2">
                      <span className="flex items-center gap-2">
                        <status.icon className={`size-4 ${status.className}`} aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-semibold">{casino?.name ?? w.casino}</span>
                        <span className="num text-xs text-subtle">{maskAccountId(account.account_id)}</span>
                      </span>
                      <span className={`mt-0.5 block text-xs ${status.className}`}>
                        {w.status[account.status]}
                        {account.status === "rejected" && account.reject_reason ? `: ${account.reject_reason}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {hasRaceAccount ? null : (
              <p className="text-sm text-muted">
                {w.verifyHint(raceCasino?.name ?? null)}{" "}
                <Link href={href("/perfil#cuentas")} className="font-semibold text-accent-text hover:underline">
                  {w.yourProfile}
                </Link>
                .
              </p>
            )}
          </section>
        );
      }}
    </ParticipationGate>
  );
}
