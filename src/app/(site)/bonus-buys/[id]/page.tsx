import { ArrowLeft, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BuysStatsGrid } from "@/components/buys/buys-stats";
import { BuysTable } from "@/components/buys/buys-table";
import { CallForm } from "@/components/calls/call-form";
import { ParticipationGate, ParticipationTitle, participationBox } from "@/components/participation-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { RealtimeRefresh } from "@/components/ui/realtime-refresh";
import { StatusPill } from "@/components/ui/status-pill";
import { getPublicBuySession } from "@/lib/buys";
import { buysStats } from "@/lib/calc/buys";
import { cn } from "@/lib/cn";
import { formatDate, formatInteger } from "@/lib/format";
import { BUY_STATUSES, statusInfo } from "@/lib/session-status";
import { createClient } from "@/lib/supabase/server";
import { submitBuyCall } from "../actions";

export async function generateMetadata({ params }: PageProps<"/bonus-buys/[id]">): Promise<Metadata> {
  const { id } = await params;
  const session = await getPublicBuySession(id);
  if (!session) return { title: "Bonus Buy" };
  return {
    title: `${session.title} · Bonus Buy`,
    description: `${formatInteger(session.buys.length)} compras${session.casino ? ` en ${session.casino.name}` : ""}. Mirá cuánto pagó cada una y pedí la próxima.`,
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
          {session.status === "live" ? (
            <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-surface" />}>
              <CallBox sessionId={session.id} callsOpen={session.calls_open} />
            </Suspense>
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

const CALL_STATUS = {
  pending: "Pendiente de revisión",
  accepted: "¡Aceptado! Ya está en la sesión.",
  rejected: "Rechazado. Podés pedir otro.",
} as const;

/** Lee la sesión: va dentro de un <Suspense>. */
function CallBox({ sessionId, callsOpen }: { sessionId: string; callsOpen: boolean }) {
  return (
    <ParticipationGate
      next={`/bonus-buys/${sessionId}`}
      title="Pedí tu slot"
      loginHint="Entrá con tu cuenta de Twitch para pedir el próximo slot que se compra."
    >
      {async (profile) => {
        const supabase = await createClient();
        const [{ data: call }, { data: taken }] = await Promise.all([
          supabase
            .from("buy_calls")
            .select("slot_name, status")
            .eq("session_id", sessionId)
            .eq("user_id", profile.id)
            .maybeSingle(),
          supabase.rpc("buy_taken_slots", { p_session: sessionId }),
        ]);
        if (!callsOpen && !call) return null;

        return (
          <section className={cn(participationBox, "space-y-2")}>
            <ParticipationTitle>Pedí tu slot</ParticipationTitle>
            {call ? (
              <p className="text-sm">
                Tu call: <strong>{call.slot_name}</strong>{" "}
                <span className={cn("text-xs", call.status === "accepted" ? "text-accent-text" : "text-subtle")}>
                  · {CALL_STATUS[call.status]}
                </span>
              </p>
            ) : null}
            {callsOpen && (!call || call.status === "rejected") ? (
              <CallForm
                action={submitBuyCall}
                hidden={{ session_id: sessionId }}
                scopeLabel="sesión"
                retry={call?.status === "rejected"}
                taken={(taken ?? []).map((t) => t.slot_name)}
              />
            ) : null}
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
