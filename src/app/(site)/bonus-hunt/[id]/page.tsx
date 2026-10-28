import { ArrowLeft, Crosshair, Target, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BonusTable } from "@/components/hunts/bonus-table";
import { ParticipationGate, ParticipationTitle, participationBox } from "@/components/participation-gate";
import { HuntStatsGrid } from "@/components/hunts/hunt-stats";
import { HuntStatusBadge } from "@/components/hunts/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { RealtimeRefresh } from "@/components/ui/realtime-refresh";
import { huntStats } from "@/lib/calc/hunt";
import { cn } from "@/lib/cn";
import { currencyPrefix, formatDate, formatInteger, formatMoney } from "@/lib/format";
import { getPublicHunt, type PublicHunt } from "@/lib/hunts";
import { createClient } from "@/lib/supabase/server";
import { CallForm, GuessForm } from "./participation-forms";

export async function generateMetadata({ params }: PageProps<"/bonus-hunt/[id]">): Promise<Metadata> {
  const { id } = await params;
  const hunt = await getPublicHunt(id);
  if (!hunt) return { title: "Bonus Hunt" };
  return {
    title: `${hunt.title} · Bonus Hunt`,
    description: `${formatInteger(hunt.bonuses.length)} bonos${hunt.casino ? ` en ${hunt.casino.name}` : ""}. Seguí la apertura en vivo y adiviná el balance.`,
  };
}

export default function HuntPage({ params }: PageProps<"/bonus-hunt/[id]">) {
  return (
    <Suspense fallback={<HuntSkeleton />}>
      <HuntDetail params={params} />
    </Suspense>
  );
}

async function HuntDetail({ params }: Pick<PageProps<"/bonus-hunt/[id]">, "params">) {
  const { id } = await params;
  const hunt = await getPublicHunt(id);
  if (!hunt) notFound();

  const stats = huntStats(hunt.start_cost, hunt.bonusList);
  const finished = hunt.status === "finished";

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-16">
      {finished ? null : <RealtimeRefresh table="hunts" id={hunt.id} />}
      <Link href="/bonus-hunt" className="flex items-center gap-1 text-sm text-subtle hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Todos los hunts
      </Link>

      <header className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <HuntStatusBadge status={hunt.status} />
          <span className="text-sm text-subtle">
            {formatDate(hunt.created_at)}
            {hunt.casino ? ` · ${hunt.casino.name}` : ""}
          </span>
        </div>
        <h1 className="mt-2 font-display text-5xl tracking-wide uppercase sm:text-6xl">{hunt.title}</h1>
      </header>

      <HuntStatsGrid
        stats={stats}
        startCost={hunt.start_cost}
        currency={hunt.currency}
        finalBalance={hunt.final_balance}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="bonus-title" className="min-w-0">
          <h2 id="bonus-title" className="mb-3 font-display text-3xl tracking-wide uppercase">
            Bonos
          </h2>
          {hunt.bonusList.length ? (
            <BonusTable bonuses={hunt.bonusList} currency={hunt.currency} bestIndex={stats.best?.index ?? null} />
          ) : (
            <EmptyState icon={Crosshair} title="Todavía sin bonos">
              Los bonos aparecen acá a medida que caen en el stream.
            </EmptyState>
          )}
        </section>

        <aside className="space-y-4">
          {finished ? <Results hunt={hunt} /> : null}
          {hunt.calls_open || hunt.guesses_open ? (
            <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-surface" />}>
              <Participation hunt={hunt} />
            </Suspense>
          ) : null}
          {!finished ? (
            <div className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
              <p className="flex items-center gap-2 font-semibold text-text">
                <Target className="size-4 text-accent-text" aria-hidden /> Adiviná el balance
              </p>
              <p className="mt-1">
                <span className="num font-semibold text-gold">{formatInteger(hunt.guessCount)}</span>{" "}
                {hunt.guessCount === 1 ? "persona apostó" : "personas apostaron"}.{" "}
                {hunt.guesses_open ? "Gana el que más se acerque al balance final." : "Las apuestas están cerradas."}
              </p>
            </div>
          ) : null}
          {hunt.casino ? (
            <a
              href={hunt.casino.referral_url}
              target="_blank"
              rel="noopener sponsored"
              className="block rounded-2xl border border-line bg-surface p-5 text-sm hover:border-accent/60"
            >
              <span className="text-subtle">Se juega en</span>{" "}
              <span className="font-semibold text-accent-light">{hunt.casino.name}</span>
              {hunt.casino.code ? (
                <span className="mt-1 block text-xs text-subtle">
                  Código <span className="num font-semibold text-gold">{hunt.casino.code}</span>
                </span>
              ) : null}
            </a>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Results({ hunt }: { hunt: PublicHunt }) {
  const top = hunt.guesses.slice(0, 10);
  return (
    <section aria-labelledby="results-title" className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
      <h2 id="results-title" className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
        <Trophy className="size-5 text-gold" aria-hidden /> Adiviná el balance
      </h2>
      {hunt.winner ? (
        <div className="mt-3 flex items-center gap-3">
          <Avatar url={hunt.winner.avatarUrl} name={hunt.winner.name} size={40} />
          <div>
            <p className="text-xs text-subtle">Ganador</p>
            <p className="font-semibold">{hunt.winner.name}</p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">Nadie apostó en este hunt.</p>
      )}
      {top.length ? (
        <ol className="mt-4 space-y-1 text-sm">
          {top.map((guess, i) => (
            <li
              key={guess.userId}
              className={cn("flex items-center gap-2 rounded-lg px-2 py-1", i === 0 && "bg-gold/10")}
            >
              <span className="num w-5 text-subtle">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{guess.user.name}</span>
              <span className="num text-muted">{formatMoney(guess.amount, hunt.currency)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

const CALL_STATUS = {
  pending: "Pendiente de revisión",
  accepted: "¡Aceptado! Ya está en el hunt.",
  rejected: "Rechazado. Podés pedir otro.",
} as const;

/** Lee la sesión: va dentro de un <Suspense>. */
function Participation({ hunt }: { hunt: PublicHunt }) {
  return (
    <ParticipationGate
      next={`/bonus-hunt/${hunt.id}`}
      loginHint="Entrá con tu cuenta de Twitch para pedir un slot o adivinar el balance."
    >
      {async (profile) => {
        const supabase = await createClient();
        const [{ data: call }, { data: guess }, { data: taken }] = await Promise.all([
          supabase
            .from("hunt_calls")
            .select("slot_name, status")
            .eq("hunt_id", hunt.id)
            .eq("user_id", profile.id)
            .maybeSingle(),
          supabase.from("hunt_guesses").select("amount").eq("hunt_id", hunt.id).eq("user_id", profile.id).maybeSingle(),
          supabase.rpc("hunt_taken_slots", { p_hunt: hunt.id }),
        ]);

        return (
          <section className={cn(participationBox, "space-y-5")}>
            <ParticipationTitle />
            {hunt.calls_open || call ? (
              <div className="space-y-2">
                {call ? (
                  <p className="text-sm">
                    Tu call: <strong>{call.slot_name}</strong>{" "}
                    <span className={cn("text-xs", call.status === "accepted" ? "text-accent-text" : "text-subtle")}>
                      · {CALL_STATUS[call.status]}
                    </span>
                  </p>
                ) : null}
                {hunt.calls_open && (!call || call.status === "rejected") ? (
                  <CallForm
                    huntId={hunt.id}
                    retry={call?.status === "rejected"}
                    taken={(taken ?? []).map((t) => t.slot_name)}
                  />
                ) : null}
              </div>
            ) : null}
            {hunt.guesses_open ? (
              <div className="space-y-2">
                {guess ? (
                  <p className="text-sm">
                    Tu apuesta: <strong className="num text-gold">{formatMoney(guess.amount, hunt.currency)}</strong>
                  </p>
                ) : null}
                <GuessForm
                  huntId={hunt.id}
                  currentGuess={guess?.amount ?? null}
                  currencyPrefix={currencyPrefix(hunt.currency)}
                />
              </div>
            ) : null}
          </section>
        );
      }}
    </ParticipationGate>
  );
}

function HuntSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pt-10 pb-16" aria-busy="true">
      <div className="h-14 w-2/3 animate-pulse rounded bg-surface-2" />
      <div className="h-20 animate-pulse rounded-2xl bg-surface" />
      <div className="h-96 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}
