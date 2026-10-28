import { ArrowLeft, Swords, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Bracket } from "@/components/battles/bracket";
import { ParticipationGate, ParticipationTitle, participationBox } from "@/components/participation-gate";
import { Avatar } from "@/components/ui/avatar";
import { ChoiceForm } from "@/components/ui/choice-form";
import { EmptyState } from "@/components/ui/empty-state";
import { RealtimeRefresh } from "@/components/ui/realtime-refresh";
import { StatusPill } from "@/components/ui/status-pill";
import { getPublicBattle, type PublicBattle } from "@/lib/battles";
import { currentMatch } from "@/lib/calc/bracket";
import { cn } from "@/lib/cn";
import { formatDate, formatInteger } from "@/lib/format";
import { BATTLE_STATUSES, statusInfo } from "@/lib/session-status";
import { createClient } from "@/lib/supabase/server";
import { pickEntry } from "../actions";

export async function generateMetadata({ params }: PageProps<"/bonus-battle/[id]">): Promise<Metadata> {
  const { id } = await params;
  const battle = await getPublicBattle(id);
  if (!battle) return { title: "Bonus Battle" };
  return {
    title: `${battle.title} · Bonus Battle`,
    description: `${formatInteger(battle.entries.length)} slots cara a cara${battle.casino ? ` en ${battle.casino.name}` : ""}. ¿A quién bancás?`,
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
            {battle.casino ? ` · ${battle.casino.name}` : ""} · {formatInteger(battle.entries.length)} slots
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
            <p className="text-sm text-muted">
              Lo bancaron {formatInteger(battle.picks[champion.id] ?? 0)} de {formatInteger(battle.totalPicks)} viewers.
            </p>
          </div>
          {battle.championBackers.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Quiénes lo bancaron">
              {battle.championBackers.slice(0, 24).map((user) => (
                <li
                  key={user.id}
                  className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pr-3 pl-1 text-xs"
                >
                  <Avatar url={user.avatarUrl} name={user.name} size={20} />
                  {user.name}
                </li>
              ))}
            </ul>
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
              Mientras tanto, elegí al slot que creas que gana todo.
            </EmptyState>
          )}
        </section>

        <aside className="space-y-4">
          {battle.status === "open" ? (
            <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-surface" />}>
              <PickBox battle={battle} />
            </Suspense>
          ) : null}
          <EntriesList battle={battle} />
        </aside>
      </div>
    </div>
  );
}

function EntriesList({ battle }: { battle: PublicBattle }) {
  const max = Math.max(1, ...Object.values(battle.picks));
  return (
    <section aria-labelledby="entries-title" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="entries-title" className="font-display text-2xl tracking-wide uppercase">
        Slots
      </h2>
      <p className="mt-1 mb-3 text-xs text-subtle">{formatInteger(battle.totalPicks)} viewers bancaron a alguno</p>
      <ol className="space-y-2">
        {battle.entries.map((entry) => {
          const picks = battle.picks[entry.id] ?? 0;
          return (
            <li key={entry.id} className="relative overflow-hidden rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <span
                aria-hidden
                style={{ width: `${Math.round((picks / max) * 100)}%` }}
                className={cn(
                  "absolute inset-y-0 left-0",
                  entry.id === battle.winner_entry_id ? "bg-gold/20" : "bg-accent/15",
                )}
              />
              <span className="relative flex items-center gap-2">
                <span className="num w-5 text-xs text-subtle">{entry.seed}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{entry.slot_name}</span>
                <span className="num text-xs text-muted">{formatInteger(picks)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Lee la sesión: va dentro de un <Suspense>. */
function PickBox({ battle }: { battle: PublicBattle }) {
  return (
    <ParticipationGate
      next={`/bonus-battle/${battle.id}`}
      title="Bancá a tu slot"
      loginHint="Entrá con tu cuenta de Twitch para elegir al slot que gana la battle."
    >
      {async (profile) => {
        const supabase = await createClient();
        const { data: pick } = await supabase
          .from("battle_picks")
          .select("entry_id")
          .eq("battle_id", battle.id)
          .eq("user_id", profile.id)
          .maybeSingle();

        return (
          <section className={participationBox}>
            <ParticipationTitle>Bancá a tu slot</ParticipationTitle>
            <p className="mt-1 mb-3 text-sm text-muted">
              ¿Cuál se lleva la battle? Podés cambiarlo hasta que arranque.
            </p>
            <ChoiceForm
              action={pickEntry}
              name="entry_id"
              options={battle.entries.map((e) => ({ id: e.id, label: e.slot_name, detail: e.provider ?? undefined }))}
              current={pick?.entry_id ?? null}
              submitLabel="Bancarlo"
              changeLabel="Cambiar"
              hidden={{ battle_id: battle.id }}
            />
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
