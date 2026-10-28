import { ArrowLeft, ShoppingCart, Vote } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BuysStatsGrid } from "@/components/buys/buys-stats";
import { BuysTable } from "@/components/buys/buys-table";
import { PollResults } from "@/components/buys/poll-results";
import { ParticipationGate, ParticipationTitle, participationBox } from "@/components/participation-gate";
import { ChoiceForm } from "@/components/ui/choice-form";
import { EmptyState } from "@/components/ui/empty-state";
import { RealtimeRefresh } from "@/components/ui/realtime-refresh";
import { StatusPill } from "@/components/ui/status-pill";
import { getPublicBuySession, type PublicPoll } from "@/lib/buys";
import { buysStats } from "@/lib/calc/buys";
import { formatDate, formatDateTime, formatInteger } from "@/lib/format";
import { BUY_STATUSES, statusInfo } from "@/lib/session-status";
import { createClient } from "@/lib/supabase/server";
import { castVote } from "../actions";

export async function generateMetadata({ params }: PageProps<"/bonus-buys/[id]">): Promise<Metadata> {
  const { id } = await params;
  const session = await getPublicBuySession(id);
  if (!session) return { title: "Bonus Buys" };
  return {
    title: `${session.title} · Bonus Buys`,
    description: `${formatInteger(session.buys.length)} compras${session.casino ? ` en ${session.casino.name}` : ""}. Mirá cuánto pagó cada una y votá la próxima.`,
  };
}

export default function BuySessionPage({ params }: PageProps<"/bonus-buys/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BuySessionDetail params={params} />
    </Suspense>
  );
}

async function BuySessionDetail({ params }: Pick<PageProps<"/bonus-buys/[id]">, "params">) {
  const { id } = await params;
  const session = await getPublicBuySession(id);
  if (!session) notFound();

  const stats = buysStats(session.buyList);
  const status = statusInfo(BUY_STATUSES, session.status);
  const openPoll = session.polls.find((p) => p.isOpen) ?? null;
  const pastPolls = session.polls.filter((p) => !p.isOpen && p.totalVotes > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-16">
      {session.status === "live" ? <RealtimeRefresh table="buy_sessions" id={session.id} /> : null}
      <Link href="/bonus-buys" className="flex items-center gap-1 text-sm text-subtle hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Todas las sesiones
      </Link>

      <header className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill label={status.label} tone={status.tone} />
          <span className="text-sm text-subtle">
            {formatDate(session.created_at)}
            {session.casino ? ` · ${session.casino.name}` : ""}
          </span>
        </div>
        <h1 className="mt-2 font-display text-5xl tracking-wide uppercase sm:text-6xl">{session.title}</h1>
      </header>

      <BuysStatsGrid stats={stats} currency={session.currency} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="buys-title" className="min-w-0">
          <h2 id="buys-title" className="mb-3 font-display text-3xl tracking-wide uppercase">
            Compras
          </h2>
          {session.buyList.length ? (
            <BuysTable buys={session.buyList} currency={session.currency} bestIndex={stats.best?.index ?? null} />
          ) : (
            <EmptyState icon={ShoppingCart} title="Todavía sin compras">
              Las compras aparecen acá a medida que se hacen en el stream.
            </EmptyState>
          )}
        </section>

        <aside className="space-y-4">
          {openPoll ? (
            <>
              <section aria-labelledby="poll-title" className="rounded-2xl border border-line bg-surface p-5">
                <h2 id="poll-title" className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
                  <Vote className="size-5 text-live" aria-hidden /> ¿Qué compramos?
                </h2>
                <p className="mt-1 mb-3 text-xs text-subtle">
                  Votación abierta · {formatInteger(openPoll.totalVotes)} votos
                </p>
                <PollResults options={openPoll.options} totalVotes={openPoll.totalVotes} />
              </section>
              <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-surface" />}>
                <VoteBox sessionId={session.id} poll={openPoll} />
              </Suspense>
            </>
          ) : null}
          {pastPolls.length ? (
            <section aria-labelledby="past-polls" className="rounded-2xl border border-line bg-surface p-5">
              <h2 id="past-polls" className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
                <Vote className="size-5 text-accent-text" aria-hidden /> Votaciones
              </h2>
              <div className="mt-3 space-y-5">
                {pastPolls.map((poll) => (
                  <div key={poll.id} className="space-y-2">
                    <p className="text-xs text-subtle">
                      {formatDateTime(poll.createdAt)} · {formatInteger(poll.totalVotes)} votos
                    </p>
                    <PollResults options={poll.options} totalVotes={poll.totalVotes} winnerId={poll.winnerOptionId} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {session.casino ? (
            <a
              href={session.casino.referral_url}
              target="_blank"
              rel="noopener sponsored"
              className="block rounded-2xl border border-line bg-surface p-5 text-sm hover:border-accent/60"
            >
              <span className="text-subtle">Se juega en</span>{" "}
              <span className="font-semibold text-accent-light">{session.casino.name}</span>
              {session.casino.code ? (
                <span className="mt-1 block text-xs text-subtle">
                  Código <span className="num font-semibold text-gold">{session.casino.code}</span>
                </span>
              ) : null}
            </a>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/** Lee la sesión: va dentro de un <Suspense>. */
function VoteBox({ sessionId, poll }: { sessionId: string; poll: PublicPoll }) {
  return (
    <ParticipationGate
      next={`/bonus-buys/${sessionId}`}
      title="Votá"
      loginHint="Entrá con tu cuenta de Twitch para votar el próximo slot."
    >
      {async (profile) => {
        const supabase = await createClient();
        const { data: vote } = await supabase
          .from("buy_poll_votes")
          .select("option_id")
          .eq("poll_id", poll.id)
          .eq("user_id", profile.id)
          .maybeSingle();

        return (
          <section className={participationBox}>
            <ParticipationTitle>Votá</ParticipationTitle>
            <div className="mt-3">
              <ChoiceForm
                action={castVote}
                name="option_id"
                options={poll.options.map((o) => ({ id: o.id, label: o.slotName }))}
                current={vote?.option_id ?? null}
                submitLabel="Votar"
                changeLabel="Cambiar voto"
                hidden={{ session_id: sessionId }}
              />
            </div>
          </section>
        );
      }}
    </ParticipationGate>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pt-10 pb-16" aria-busy="true">
      <div className="h-14 w-2/3 animate-pulse rounded bg-surface-2" />
      <div className="h-20 animate-pulse rounded-2xl bg-surface" />
      <div className="h-96 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}
