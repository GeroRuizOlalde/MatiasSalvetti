import { ArrowLeft, ExternalLink, Inbox, Vote } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BuysStatsGrid } from "@/components/buys/buys-stats";
import { PollResults } from "@/components/buys/poll-results";
import { ActionButton } from "@/components/panel/action-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePanelProfile } from "@/lib/auth/session";
import { buysStats } from "@/lib/calc/buys";
import { formatDateTime, formatInteger } from "@/lib/format";
import { BUY_STATUSES, statusInfo } from "@/lib/session-status";
import { createClient } from "@/lib/supabase/server";
import { closePoll, deleteBuySession } from "../actions";
import { AddBuyForm, BuyRowForm, BuySessionForm, OpenPollForm } from "../forms";

export const metadata: Metadata = { title: "Bonus Buys" };

export default async function PanelBuySessionPage({ params }: PageProps<"/panel/buys/[id]">) {
  const profile = await requirePanelProfile("mod");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("buy_sessions")
    .select("id, title, casino_id, currency, status, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound();

  const [{ data: buys }, { data: polls }, { data: counts }, { data: casinos }] = await Promise.all([
    supabase
      .from("buys")
      .select("id, position, slot_name, provider, bet, cost, payout")
      .eq("session_id", id)
      .order("position")
      .order("created_at"),
    supabase
      .from("buy_polls")
      .select(
        "id, is_open, created_at, winner_option_id, options:buy_poll_options!buy_poll_options_poll_id_fkey(id, position, slot_name)",
      )
      .eq("session_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.rpc("buy_poll_counts", { p_session: id }),
    supabase.from("casinos").select("id, name").order("sort_order").order("name"),
  ]);

  const votes = new Map((counts ?? []).map((c) => [c.option_id, c.votes]));
  const pollViews = (polls ?? []).map((poll) => {
    const options = [...poll.options]
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, slotName: o.slot_name, votes: votes.get(o.id) ?? 0 }));
    return { ...poll, options, total: options.reduce((sum, o) => sum + o.votes, 0) };
  });
  const openPoll = pollViews.find((p) => p.is_open);
  const pastPolls = pollViews.filter((p) => !p.is_open);

  const list = buys ?? [];
  const stats = buysStats(list);
  const locked = session.status === "finished";
  const last = list.at(-1);
  const status = statusInfo(BUY_STATUSES, session.status);

  return (
    <div className="space-y-6">
      <Link href="/panel/buys" className="flex items-center gap-1 text-sm text-subtle hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Sesiones
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-wide uppercase">{session.title}</h1>
        <StatusPill label={status.label} tone={status.tone} />
        {session.status !== "draft" ? (
          <Link
            href={`/bonus-buys/${session.id}`}
            target="_blank"
            className="flex items-center gap-1 text-sm text-accent-text"
          >
            Ver en la web <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      <BuysStatsGrid stats={stats} currency={session.currency} />

      <section aria-labelledby="settings" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="settings" className="mb-3 font-semibold">
          Datos de la sesión
        </h2>
        <BuySessionForm key={session.updated_at} session={session} casinos={casinos ?? []} />
      </section>

      <section aria-labelledby="poll" className="space-y-3">
        <h2 id="poll" className="flex items-center gap-2 font-semibold">
          <Vote className="size-4 text-accent-text" aria-hidden /> Votación «¿qué compramos?»
        </h2>
        {openPoll ? (
          <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent/5 p-5">
            <p className="text-sm text-muted">
              Abierta desde {formatDateTime(openPoll.created_at)} ·{" "}
              <span className="num font-semibold text-text">{formatInteger(openPoll.total)}</span> votos
            </p>
            <PollResults options={openPoll.options} totalVotes={openPoll.total} />
            <ActionButton
              action={closePoll}
              fields={{ session_id: session.id }}
              variant="primary"
              pendingLabel="Cerrando…"
            >
              Cerrar votación
            </ActionButton>
          </div>
        ) : null}
        {session.status === "live" ? (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="mb-3 text-sm text-muted">
              {openPoll ? "Abrir una nueva cierra la actual." : "Elegí entre 2 y 8 slots para que voten los viewers."}
            </p>
            <OpenPollForm sessionId={session.id} />
          </div>
        ) : !openPoll ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">
            Las votaciones se abren con la sesión «En vivo».
          </p>
        ) : null}
        {pastPolls.length ? (
          <details className="rounded-2xl border border-line bg-surface p-5">
            <summary className="cursor-pointer text-sm font-semibold">
              Votaciones anteriores ({pastPolls.length})
            </summary>
            <div className="mt-4 space-y-5">
              {pastPolls.map((poll) => (
                <div key={poll.id} className="space-y-2">
                  <p className="text-xs text-subtle">
                    {formatDateTime(poll.created_at)} · {formatInteger(poll.total)} votos
                  </p>
                  <PollResults options={poll.options} totalVotes={poll.total} winnerId={poll.winner_option_id} />
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <section aria-labelledby="buys" className="space-y-3">
        <h2 id="buys" className="font-semibold">
          Compras <span className="num text-sm font-normal text-subtle">({formatInteger(list.length)})</span>
        </h2>
        {locked ? null : (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <AddBuyForm sessionId={session.id} defaults={last ? { bet: last.bet, cost: last.cost } : undefined} />
          </div>
        )}
        {list.length ? (
          <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {list.map((buy, i) => (
              <li
                key={`${buy.id}-${buy.bet}-${buy.cost}-${buy.payout}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
              >
                <span className="num w-8 text-sm text-subtle">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{buy.slot_name}</p>
                  <p className="truncate text-xs text-subtle">{buy.provider ?? "Sin proveedor"}</p>
                </div>
                <BuyRowForm sessionId={session.id} buy={buy} currency={session.currency} locked={locked} />
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon={Inbox} title="Sin compras">
            Cargá cada compra con su apuesta y su costo; el pago cuando se abre.
          </EmptyState>
        )}
      </section>

      {session.status === "draft" || profile.role === "admin" ? (
        <section className="border-t border-line pt-4">
          <ActionButton
            action={deleteBuySession}
            fields={{ id: session.id }}
            variant="ghost"
            pendingLabel="Borrando…"
            confirmText="¿Borrar la sesión con todas sus compras y votaciones? No se puede deshacer."
            className="[&_button]:text-live"
          >
            Borrar sesión
          </ActionButton>
        </section>
      ) : null}
    </div>
  );
}
