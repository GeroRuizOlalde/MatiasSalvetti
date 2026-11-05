import type { Locale } from "@/i18n/config";
import { getI18n, pageLocale } from "@/i18n/server";
import { ArrowLeft, Swords, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Bracket } from "@/components/battles/bracket";
import { CallForm } from "@/components/calls/call-form";
import { retryReason } from "@/lib/call-reject";
import {
  ParticipationGate,
  ParticipationTitle,
  participationBox,
} from "@/components/participation-gate";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { RealtimeRefresh } from "@/components/ui/realtime-refresh";
import { StatusPill } from "@/components/ui/status-pill";
import { getPublicBattle, type PublicBattle } from "@/lib/battles";
import { BRACKET_SIZES, currentMatch } from "@/lib/calc/bracket";
import { cn } from "@/lib/cn";
import { formatDate, formatInteger } from "@/lib/format";
import { BATTLE_STATUSES, statusInfo } from "@/lib/session-status";
import { createClient } from "@/lib/supabase/server";
import { submitBattleCall } from "../actions";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/bonus-battle/[id]">): Promise<Metadata> {
  const [{ id }, lang] = await Promise.all([params, pageLocale(params)]);
  const { t } = getI18n(lang);
  const battle = await getPublicBattle(id);
  if (!battle) return { title: "Bonus Battle" };
  return {
    title: `${battle.title} · Bonus Battle`,
    description: t.battles.detailDescription(
      formatInteger(battle.entries.length),
      battle.casino?.name ?? null,
    ),
  };
}

export default function BattlePage({
  params,
}: PageProps<"/[lang]/bonus-battle/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BattleDetail params={params} />
    </Suspense>
  );
}

async function BattleDetail({
  params,
}: Pick<PageProps<"/[lang]/bonus-battle/[id]">, "params">) {
  const [{ id }, lang] = await Promise.all([params, pageLocale(params)]);
  const { t, href } = getI18n(lang);
  const battle = await getPublicBattle(id);
  if (!battle) notFound();

  const status = statusInfo(BATTLE_STATUSES, battle.status);
  const champion =
    battle.entries.find((e) => e.id === battle.winner_entry_id) ?? null;
  const current = currentMatch(battle.matches);
  // Ronda en la que arranca: 2 slots = final, 4 = semifinal, 8 = cuartos…
  const instance = BRACKET_SIZES.some((b) => b.size === battle.size)
    ? t.battle.roundName(Math.log2(battle.size) - 1, 1)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-16">
      {battle.status !== "finished" ? (
        <RealtimeRefresh table="battles" id={battle.id} />
      ) : null}
      <Link
        href={href("/bonus-battle")}
        className="flex items-center gap-1 text-sm text-subtle hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t.battles.all}
      </Link>

      <header className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill
            label={t.status.battle[battle.status]}
            tone={status.tone}
          />
          <span className="text-sm text-subtle">
            {formatDate(battle.created_at, lang)}
            {battle.casino ? ` · ${battle.casino.name}` : ""} ·{" "}
            {formatInteger(battle.entries.length)}/{formatInteger(battle.size)}{" "}
            slots{instance ? ` · ${t.battles.startsAt(instance)}` : ""}
          </span>
        </div>
        <h1 className="mt-2 font-display text-5xl tracking-wide uppercase sm:text-6xl">
          {battle.title}
        </h1>
      </header>

      {champion ? (
        <section className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl border border-gold/40 bg-gold/5 p-6">
          <Trophy className="size-10 text-gold" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
              {t.battles.champion}
            </p>
            <p className="font-display text-4xl tracking-wide text-gold uppercase">
              {champion.slot_name}
            </p>
          </div>
          {champion.calledBy ? (
            <span className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pr-4 pl-1 font-semibold">
              <Avatar
                url={champion.calledBy.avatarUrl}
                name={champion.calledBy.name}
                size={32}
              />
              <span>
                <span className="block text-[10px] font-normal tracking-wide text-subtle uppercase">
                  {t.battles.calledBy}
                </span>
                {champion.calledBy.name}
              </span>
            </span>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="bracket-title" className="min-w-0">
          <h2
            id="bracket-title"
            className="mb-3 font-display text-3xl tracking-wide uppercase"
          >
            {t.battles.bracket}
          </h2>
          {battle.matches.length ? (
            <Bracket
              matches={battle.matches}
              entries={battle.entries}
              currency={battle.currency}
              currentId={current?.id ?? null}
              lang={lang}
            />
          ) : (
            <EmptyState icon={Swords} title={t.battles.noBracketTitle}>
              {t.battles.noBracket}
            </EmptyState>
          )}
        </section>

        <aside className="space-y-4">
          {battle.status === "open" ? (
            <Suspense
              fallback={
                <div className="h-48 animate-pulse rounded-2xl bg-surface" />
              }
            >
              <CallBox battle={battle} lang={lang} />
            </Suspense>
          ) : null}
          <EntriesList battle={battle} lang={lang} />
        </aside>
      </div>
    </div>
  );
}

function EntriesList({ battle, lang }: { battle: PublicBattle; lang: Locale }) {
  const { t } = getI18n(lang);
  return (
    <section
      aria-labelledby="entries-title"
      className="rounded-2xl border border-line bg-surface p-5"
    >
      <h2
        id="entries-title"
        className="font-display text-2xl tracking-wide uppercase"
      >
        {t.battles.slots}
      </h2>
      <p className="mt-1 mb-3 text-xs text-subtle">
        {t.battles.spots(
          formatInteger(battle.entries.length),
          formatInteger(battle.size),
        )}
      </p>
      {battle.entries.length ? (
        <ol className="space-y-2">
          {battle.entries.map((entry) => (
            <li
              key={entry.id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                entry.id === battle.winner_entry_id
                  ? "bg-gold/15"
                  : "bg-surface-2",
              )}
            >
              <span className="num w-5 text-xs text-subtle">{entry.seed}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {entry.slot_name}
              </span>
              {entry.calledBy ? (
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                  <Avatar
                    url={entry.calledBy.avatarUrl}
                    name={entry.calledBy.name}
                    size={18}
                  />
                  <span className="max-w-24 truncate">
                    {entry.calledBy.name}
                  </span>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-subtle">{t.battles.noEntries}</p>
      )}
    </section>
  );
}

/** Lee la sesión: va dentro de un <Suspense>. */
function CallBox({ battle, lang }: { battle: PublicBattle; lang: Locale }) {
  const { t } = getI18n(lang);
  return (
    <ParticipationGate
      next={`/bonus-battle/${battle.id}`}
      title={t.battles.callSlot}
      loginHint={t.battles.loginHint}
      lang={lang}
    >
      {async (profile) => {
        const supabase = await createClient();
        const [{ data: call }, { data: taken }] = await Promise.all([
          supabase
            .from("battle_calls")
            .select("slot_name, status, reject_reason")
            .eq("battle_id", battle.id)
            .eq("user_id", profile.id)
            .maybeSingle(),
          supabase.rpc("battle_taken_slots", { p_battle: battle.id }),
        ]);
        const retry = retryReason(call);
        const full = battle.entries.length >= battle.size;

        return (
          <section className={cn(participationBox, "space-y-2")}>
            <ParticipationTitle>{t.battles.callSlot}</ParticipationTitle>
            {call ? (
              <p className="text-sm">
                {t.calls.yourCall} <strong>{call.slot_name}</strong>{" "}
                <span
                  className={cn(
                    "text-xs",
                    call.status === "accepted"
                      ? "text-accent-text"
                      : "text-subtle",
                  )}
                >
                  ·{" "}
                  {retry
                    ? t.calls.rejectedRetry[retry]
                    : t.calls.status.battle[call.status]}
                </span>
              </p>
            ) : null}
            {(!call || retry) && !full ? (
              <CallForm
                action={submitBattleCall}
                hidden={{ battle_id: battle.id }}
                scopeLabel={t.battles.scope}
                taken={(taken ?? []).map((row) => row.slot_name)}
              />
            ) : null}
            {full && !call ? (
              <p className="text-sm text-muted">{t.battles.full}</p>
            ) : null}
          </section>
        );
      }}
    </ParticipationGate>
  );
}

function PageSkeleton() {
  return (
    <div
      className="mx-auto max-w-7xl space-y-6 px-4 pt-10 pb-16"
      aria-busy="true"
    >
      <div className="h-14 w-2/3 animate-pulse rounded bg-surface-2" />
      <div className="h-96 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}
