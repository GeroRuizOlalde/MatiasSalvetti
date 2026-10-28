import { ArrowLeft, Swords, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Bracket } from "@/components/battles/bracket";
import { CallForm } from "@/components/calls/call-form";
import { ParticipationGate, ParticipationTitle, participationBox } from "@/components/participation-gate";
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

export async function generateMetadata({ params }: PageProps<"/bonus-battle/[id]">): Promise<Metadata> {
  const { id } = await params;
  const battle = await getPublicBattle(id);
  if (!battle) return { title: "Bonus Battle" };
  return {
    title: `${battle.title} · Bonus Battle`,
    description: `${formatInteger(battle.entries.length)} slots cara a cara${battle.casino ? ` en ${battle.casino.name}` : ""}. Calleá tu slot y pasá de ronda.`,
  };
}

export default function BattlePage({ params }: PageProps<"/bonus-battle/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BattleDetail params={params} />
    </Suspense>
  );
}

async function BattleDetail({ params }: Pick<PageProps<"/bonus-battle/[id]">, "params">) {
  const { id } = await params;
  const battle = await getPublicBattle(id);
  if (!battle) notFound();

  const status = statusInfo(BATTLE_STATUSES, battle.status);
  const champion = battle.entries.find((e) => e.id === battle.winner_entry_id) ?? null;
  const current = currentMatch(battle.matches);
  const instance = BRACKET_SIZES.find((b) => b.size === battle.size)?.label;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-16">
      {battle.status !== "finished" ? <RealtimeRefresh table="battles" id={battle.id} /> : null}
      <Link href="/bonus-battle" className="flex items-center gap-1 text-sm text-subtle hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Todas las battles
      </Link>

      <header className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill label={status.label} tone={status.tone} />
          <span className="text-sm text-subtle">
            {formatDate(battle.created_at)}
            {battle.casino ? ` · ${battle.casino.name}` : ""} · {formatInteger(battle.entries.length)}/
            {formatInteger(battle.size)} slots{instance ? ` · arranca en ${instance}` : ""}
          </span>
        </div>
        <h1 className="mt-2 font-display text-5xl tracking-wide uppercase sm:text-6xl">{battle.title}</h1>
      </header>

      {champion ? (
        <section className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl border border-gold/40 bg-gold/5 p-6">
          <Trophy className="size-10 text-gold" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Campeón</p>
            <p className="font-display text-4xl tracking-wide text-gold uppercase">{champion.slot_name}</p>
          </div>
          {champion.calledBy ? (
            <span className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pr-4 pl-1 font-semibold">
              <Avatar url={champion.calledBy.avatarUrl} name={champion.calledBy.name} size={32} />
              <span>
                <span className="block text-[10px] font-normal tracking-wide text-subtle uppercase">Lo calleó</span>
                {champion.calledBy.name}
              </span>
            </span>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="bracket-title" className="min-w-0">
          <h2 id="bracket-title" className="mb-3 font-display text-3xl tracking-wide uppercase">
            Cuadro
          </h2>
          {battle.matches.length ? (
            <Bracket
              matches={battle.matches}
              entries={battle.entries}
              currency={battle.currency}
              currentId={current?.id ?? null}
            />
          ) : (
            <EmptyState icon={Swords} title="El cuadro se arma al arrancar">
              Mientras tanto, calleá tu slot: cuando estén todos, arranca y en cada cruce pasa el que paga más.
            </EmptyState>
          )}
        </section>

        <aside className="space-y-4">
          {battle.status === "open" ? (
            <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-surface" />}>
              <CallBox battle={battle} />
            </Suspense>
          ) : null}
          <EntriesList battle={battle} />
        </aside>
      </div>
    </div>
  );
}

function EntriesList({ battle }: { battle: PublicBattle }) {
  return (
    <section aria-labelledby="entries-title" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="entries-title" className="font-display text-2xl tracking-wide uppercase">
        Slots
      </h2>
      <p className="mt-1 mb-3 text-xs text-subtle">
        {formatInteger(battle.entries.length)} de {formatInteger(battle.size)} lugares
      </p>
      {battle.entries.length ? (
        <ol className="space-y-2">
          {battle.entries.map((entry) => (
            <li
              key={entry.id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                entry.id === battle.winner_entry_id ? "bg-gold/15" : "bg-surface-2",
              )}
            >
              <span className="num w-5 text-xs text-subtle">{entry.seed}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{entry.slot_name}</span>
              {entry.calledBy ? (
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                  <Avatar url={entry.calledBy.avatarUrl} name={entry.calledBy.name} size={18} />
                  <span className="max-w-24 truncate">{entry.calledBy.name}</span>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-subtle">Todavía no entró ningún slot.</p>
      )}
    </section>
  );
}

const CALL_STATUS = {
  pending: "Pendiente de revisión",
  accepted: "¡Aceptado! Tu slot está en la battle.",
  rejected: "Rechazado. Podés pedir otro.",
} as const;

/** Lee la sesión: va dentro de un <Suspense>. */
function CallBox({ battle }: { battle: PublicBattle }) {
  return (
    <ParticipationGate
      next={`/bonus-battle/${battle.id}`}
      title="Calleá tu slot"
      loginHint="Entrá con tu cuenta de Twitch para callear el slot con el que entrás a la battle."
    >
      {async (profile) => {
        const supabase = await createClient();
        const [{ data: call }, { data: taken }] = await Promise.all([
          supabase
            .from("battle_calls")
            .select("slot_name, status")
            .eq("battle_id", battle.id)
            .eq("user_id", profile.id)
            .maybeSingle(),
          supabase.rpc("battle_taken_slots", { p_battle: battle.id }),
        ]);
        const full = battle.entries.length >= battle.size;

        return (
          <section className={cn(participationBox, "space-y-2")}>
            <ParticipationTitle>Calleá tu slot</ParticipationTitle>
            {call ? (
              <p className="text-sm">
                Tu call: <strong>{call.slot_name}</strong>{" "}
                <span className={cn("text-xs", call.status === "accepted" ? "text-accent-text" : "text-subtle")}>
                  · {CALL_STATUS[call.status]}
                </span>
              </p>
            ) : null}
            {(!call || call.status === "rejected") && !full ? (
              <CallForm
                action={submitBattleCall}
                hidden={{ battle_id: battle.id }}
                scopeLabel="battle"
                retry={call?.status === "rejected"}
                taken={(taken ?? []).map((t) => t.slot_name)}
              />
            ) : null}
            {full && (!call || call.status === "rejected") ? (
              <p className="text-sm text-muted">El cuadro ya está completo.</p>
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
      <div className="h-96 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}
