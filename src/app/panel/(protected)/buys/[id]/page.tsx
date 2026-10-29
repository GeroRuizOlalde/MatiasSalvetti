import { ArrowLeft, ExternalLink, Inbox, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BuysStatsGrid } from "@/components/buys/buys-stats";
import { ActionButton } from "@/components/panel/action-button";
import { TipeoButtons } from "@/components/panel/tipeo-buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePanelProfile } from "@/lib/auth/session";
import { buysStats } from "@/lib/calc/buys";
import { formatDateTime, formatInteger, formatMoney, formatMulti } from "@/lib/format";
import { BUY_STATUSES, statusInfo } from "@/lib/session-status";
import { createClient } from "@/lib/supabase/server";
import { isTipeoHit } from "@/lib/tipeos";
import { deleteBuySession } from "../actions";
import { AddBuyForm, BuyCallReviewForm, BuyRowForm, BuySessionForm } from "../forms";
import { casinoOptions } from "@/lib/panel-casinos";

export const metadata: Metadata = { title: "Bonus Buy" };

export default async function PanelBuySessionPage({ params }: PageProps<"/panel/buys/[id]">) {
  const profile = await requirePanelProfile("mod");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("buy_sessions")
    .select("id, title, casino_id, currency, status, calls_open, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound();

  const [{ data: buys }, { data: calls }, { data: casinos }, { data: tipeos }] = await Promise.all([
    supabase
      .from("buys")
      .select("id, position, slot_name, provider, bet, cost, payout, called_by")
      .eq("session_id", id)
      .order("position")
      .order("created_at"),
    supabase
      .from("buy_calls")
      .select("id, user_id, slot_name, created_at")
      .eq("session_id", id)
      .eq("status", "pending")
      .order("created_at"),
    casinoOptions(supabase, session.casino_id),
    supabase.from("tipeos").select("buy_id, status").eq("session_id", id),
  ]);

  const userIds = [...(buys ?? []).map((b) => b.called_by), ...(calls ?? []).map((c) => c.user_id)];
  const ids = [...new Set(userIds.filter((u): u is string => Boolean(u)))];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, display_name, twitch_login").in("id", ids)
    : { data: [] };
  const nameOf = (userId: string | null) => {
    const p = people?.find((x) => x.id === userId);
    return p ? p.display_name || p.twitch_login || "Viewer" : null;
  };

  const list = buys ?? [];
  const stats = buysStats(list);
  const locked = session.status === "finished";
  const last = list.at(-1);
  const status = statusInfo(BUY_STATUSES, session.status);
  const defaults = last ? { bet: last.bet, cost: last.cost } : undefined;
  const tipeoStatus = (buyId: string) => tipeos?.find((t) => t.buy_id === buyId)?.status;
  // Compras de calls que pagaron más de 110x, sin decidir todavía.
  const recommended = list.filter((b) => isTipeoHit(b) && !tipeoStatus(b.id));

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

      {recommended.length ? (
        <section aria-labelledby="tipeos" className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
          <h2 id="tipeos" className="mb-1 flex items-center gap-2 font-semibold text-gold">
            <Sparkles className="size-4" aria-hidden /> Tipeos recomendados
          </h2>
          <p className="mb-3 text-sm text-muted">Estos calls pagaron más de 110x. ¿Le das tipeo al viewer?</p>
          <ul className="divide-y divide-gold/20">
            {recommended.map((buy) => (
              <li key={buy.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{nameOf(buy.called_by) ?? "Viewer"}</p>
                  <p className="text-sm text-muted">
                    {buy.slot_name} · {formatMoney(buy.bet, session.currency)} →{" "}
                    {formatMoney(buy.payout ?? 0, session.currency)}{" "}
                    <span className="num font-semibold text-gold">{formatMulti((buy.payout ?? 0) / buy.bet)}</span>
                  </p>
                </div>
                <TipeoButtons kind="buy" id={buy.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="calls">
        <h2 id="calls" className="mb-3 flex items-center gap-2 font-semibold">
          Calls por revisar
          <span className="num rounded-full bg-surface-2 px-2 text-xs text-muted">
            {formatInteger(calls?.length ?? 0)}
          </span>
          {!session.calls_open || session.status !== "live" ? (
            <span className="text-xs font-normal text-subtle">
              (los viewers piden con la sesión «En vivo» y los calls abiertos)
            </span>
          ) : null}
        </h2>
        {calls?.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {calls.map((call) => (
              <li key={call.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{call.slot_name}</p>
                  <p className="text-xs text-subtle">
                    {nameOf(call.user_id) ?? "Viewer"} · {formatDateTime(call.created_at)}
                  </p>
                </div>
                {locked ? null : <BuyCallReviewForm sessionId={session.id} callId={call.id} defaults={defaults} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">
            No hay calls pendientes.
          </p>
        )}
      </section>

      <section aria-labelledby="buys" className="space-y-3">
        <h2 id="buys" className="font-semibold">
          Compras <span className="num text-sm font-normal text-subtle">({formatInteger(list.length)})</span>
        </h2>
        {locked ? null : (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <AddBuyForm sessionId={session.id} defaults={defaults} />
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
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="min-w-0 truncate">{buy.slot_name}</span>
                    {tipeoStatus(buy.id) === "given" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
                        <Sparkles className="size-3" aria-hidden /> Tipeo
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-subtle">
                    {buy.provider ?? "Sin proveedor"}
                    {buy.called_by ? ` · call de ${nameOf(buy.called_by) ?? "un viewer"}` : ""}
                  </p>
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
            confirmText="¿Borrar la sesión con todas sus compras y calls? No se puede deshacer."
            className="[&_button]:text-live"
          >
            Borrar sesión
          </ActionButton>
        </section>
      ) : null}
    </div>
  );
}
