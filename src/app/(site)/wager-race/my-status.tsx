import { BadgeCheck, Clock, XCircle } from "lucide-react";
import { ParticipationGate, ParticipationTitle, participationBox } from "@/components/participation-gate";
import { getActiveCasinos } from "@/lib/casinos";
import { formatMoney, maskAccountId } from "@/lib/format";
import type { LeaderboardRow, PublicRace } from "@/lib/wager";
import { createClient } from "@/lib/supabase/server";
import { VerificationForm } from "./verification-form";

const STATUS = {
  pending: { icon: Clock, label: "En revisión", className: "text-gold" },
  approved: { icon: BadgeCheck, label: "Verificada", className: "text-emerald-400" },
  rejected: { icon: XCircle, label: "Rechazada", className: "text-live" },
} as const;

/** Lee la sesión: va dentro de un <Suspense>. Estado de verificación del viewer y su puesto. */
export function MyRaceStatus({ race, leaderboard }: { race: PublicRace | null; leaderboard: LeaderboardRow[] }) {
  return (
    <ParticipationGate
      next="/wager-race"
      title="Verificación"
      loginHint="Entrá con tu cuenta de Twitch para verificar tu cuenta de casino y aparecer en el ranking."
    >
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
        const available = casinos.filter((c) => !done.has(c.id));
        const raceCasino = race ? casinos.find((c) => c.slug === race.casino?.slug) : undefined;

        return (
          <section className={`${participationBox} space-y-5`}>
            <ParticipationTitle>Tu cuenta</ParticipationTitle>
            {race && mine ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                Vas <strong className="num text-gold">{mine.rank}.º</strong> con{" "}
                <span className="num">{formatMoney(mine.wager, race.currency)}</span> de wager.
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
                        <span className="min-w-0 flex-1 truncate font-semibold">{casino?.name ?? "Casino"}</span>
                        <span className="num text-xs text-subtle">{maskAccountId(account.account_id)}</span>
                      </span>
                      <span className={`mt-0.5 block text-xs ${status.className}`}>
                        {status.label}
                        {account.status === "rejected" && account.reject_reason ? `: ${account.reject_reason}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {available.length ? (
              <div>
                <p className="mb-3 text-sm text-muted">
                  Cargá el ID de tu cuenta y una captura. Tiene que ser una cuenta creada con el link de Matías.
                </p>
                <VerificationForm
                  casinos={available.map(({ id, name }) => ({ id, name }))}
                  defaultCasinoId={available.some((c) => c.id === raceCasino?.id) ? raceCasino?.id : undefined}
                />
              </div>
            ) : (
              <p className="text-sm text-muted">Ya cargaste tus cuentas de todos los casinos.</p>
            )}
          </section>
        );
      }}
    </ParticipationGate>
  );
}
