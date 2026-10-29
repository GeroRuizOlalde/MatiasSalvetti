import { ArrowLeft, ExternalLink, Trash2, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionButton } from "@/components/panel/action-button";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePanelProfile } from "@/lib/auth/session";
import { BRACKET_SIZES, groupRounds } from "@/lib/calc/bracket";
import { formatDateTime, formatInteger } from "@/lib/format";
import { BATTLE_STATUSES, statusInfo } from "@/lib/session-status";
import { createClient } from "@/lib/supabase/server";
import { deleteBattle, deleteEntry, resetBattle, shuffleEntries, startBattle } from "../actions";
import { AddEntryForm, BattleCallReviewForm, BattleForm, MatchForm } from "../forms";
import { casinoOptions } from "@/lib/panel-casinos";

export const metadata: Metadata = { title: "Bonus Battle" };

export default async function PanelBattlePage({ params }: PageProps<"/panel/battles/[id]">) {
  const profile = await requirePanelProfile("mod");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: battle } = await supabase
    .from("battles")
    .select("id, title, casino_id, currency, status, size, winner_entry_id, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!battle) notFound();

  const [{ data: entries }, { data: matches }, { data: calls }, { data: casinos }] = await Promise.all([
    supabase
      .from("battle_entries")
      .select("id, seed, slot_name, provider, called_by")
      .eq("battle_id", id)
      .order("seed")
      .order("created_at"),
    supabase
      .from("battle_matches")
      .select("id, round, slot, entry_a, entry_b, bet_a, payout_a, bet_b, payout_b, winner_entry_id")
      .eq("battle_id", id),
    supabase
      .from("battle_calls")
      .select("id, user_id, slot_name, created_at")
      .eq("battle_id", id)
      .eq("status", "pending")
      .order("created_at"),
    casinoOptions(supabase, battle.casino_id),
  ]);

  const list = entries ?? [];
  const userIds = [...list.map((e) => e.called_by), ...(calls ?? []).map((c) => c.user_id)];
  const ids = [...new Set(userIds.filter((u): u is string => Boolean(u)))];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, display_name, twitch_login").in("id", ids)
    : { data: [] };
  const viewerOf = (userId: string | null) => {
    const p = people?.find((x) => x.id === userId);
    return p ? p.display_name || p.twitch_login || "Viewer" : null;
  };
  /** Slot y, si vino de un call, quién lo pidió. */
  const nameOf = (entryId: string | null) => {
    const entry = list.find((e) => e.id === entryId);
    if (!entry) return "Por definir";
    const caller = viewerOf(entry.called_by);
    return caller ? `${entry.slot_name} (${caller})` : entry.slot_name;
  };
  const started = battle.status === "live" || battle.status === "finished";
  const status = statusInfo(BATTLE_STATUSES, battle.status);
  const rounds = groupRounds(matches ?? []);
  const canStart = list.length === battle.size;
  const instance = BRACKET_SIZES.find((b) => b.size === battle.size)?.label ?? "";

  return (
    <div className="space-y-6">
      <Link href="/panel/battles" className="flex items-center gap-1 text-sm text-subtle hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Battles
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-wide uppercase">{battle.title}</h1>
        <StatusPill label={status.label} tone={status.tone} />
        {battle.status !== "draft" ? (
          <Link
            href={`/bonus-battle/${battle.id}`}
            target="_blank"
            className="flex items-center gap-1 text-sm text-accent-text"
          >
            Ver en la web <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      {battle.status === "finished" ? (
        <p className="flex items-center gap-2 rounded-2xl border border-gold/40 bg-gold/5 p-5 text-sm">
          <Trophy className="size-5 text-gold" aria-hidden /> Campeón:{" "}
          <strong className="text-gold">{nameOf(battle.winner_entry_id)}</strong>
        </p>
      ) : null}

      <section aria-labelledby="settings" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="settings" className="mb-3 font-semibold">
          Datos de la battle
        </h2>
        <BattleForm key={battle.updated_at} battle={battle} casinos={casinos ?? []} />
      </section>

      {started ? null : (
        <section aria-labelledby="calls">
          <h2 id="calls" className="mb-3 flex items-center gap-2 font-semibold">
            Calls por revisar
            <span className="num rounded-full bg-surface-2 px-2 text-xs text-muted">
              {formatInteger(calls?.length ?? 0)}
            </span>
            {battle.status !== "open" ? (
              <span className="text-xs font-normal text-subtle">
                (los viewers piden con la battle en «Calls abiertos»)
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
                      {viewerOf(call.user_id) ?? "Viewer"} · {formatDateTime(call.created_at)}
                    </p>
                  </div>
                  <BattleCallReviewForm battleId={battle.id} callId={call.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">
              No hay calls pendientes.
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="entries" className="space-y-3">
        <h2 id="entries" className="font-semibold">
          Slots{" "}
          <span className="num text-sm font-normal text-subtle">
            ({formatInteger(list.length)}/{formatInteger(battle.size)} · arranca en {instance})
          </span>
        </h2>
        {started || canStart ? null : (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <AddEntryForm battleId={battle.id} />
          </div>
        )}
        {list.length ? (
          <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {list.map((entry, i) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="num w-8 text-sm text-subtle">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{entry.slot_name}</p>
                  <p className="truncate text-xs text-subtle">
                    {entry.provider ?? "Sin proveedor"}
                    {entry.called_by ? ` · call de ${viewerOf(entry.called_by) ?? "un viewer"}` : ""}
                  </p>
                </div>
                {started ? null : (
                  <ActionButton
                    action={deleteEntry}
                    fields={{ id: entry.id, battle_id: battle.id }}
                    variant="ghost"
                    pendingLabel="…"
                    confirmText={`¿Quitar ${entry.slot_name}? Si vino de un call, el viewer puede pedir otro.`}
                  >
                    <Trash2 className="size-4" aria-label="Quitar slot" />
                  </ActionButton>
                )}
              </li>
            ))}
          </ol>
        ) : null}

        {started ? null : (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-5">
            <p className="w-full text-sm text-muted">
              Los cruces de la primera ronda salen del orden: 1 contra 2, 3 contra 4… Arrancar cierra los calls y arma
              el cuadro; en cada cruce pasa el que pagó más (multi).
              {canStart
                ? ""
                : ` Faltan ${formatInteger(battle.size - list.length)} slots para arrancar en ${instance}.`}
            </p>
            {list.length > 2 ? (
              <ActionButton action={shuffleEntries} fields={{ battle_id: battle.id }} pendingLabel="Sorteando…">
                Sortear orden
              </ActionButton>
            ) : null}
            {canStart ? (
              <ActionButton
                action={startBattle}
                fields={{ battle_id: battle.id }}
                variant="primary"
                pendingLabel="Armando el cuadro…"
                confirmText="¿Arrancar la battle? Se cierran los calls y se arma el cuadro."
              >
                Arrancar battle
              </ActionButton>
            ) : null}
          </div>
        )}
      </section>

      {started ? (
        <section aria-labelledby="bracket" className="space-y-4">
          <h2 id="bracket" className="font-semibold">
            Cuadro
          </h2>
          {rounds.map((round) => (
            <div key={round.round} className="space-y-2">
              <h3 className="text-sm font-semibold text-subtle">{round.name}</h3>
              <ul className="grid gap-3 md:grid-cols-2">
                {round.matches.map((match) => (
                  <li
                    key={`${match.id}-${match.entry_a}-${match.entry_b}-${match.payout_a}-${match.payout_b}`}
                    className="rounded-2xl border border-line bg-surface p-4"
                  >
                    {match.entry_a && match.entry_b ? (
                      <MatchForm
                        battleId={battle.id}
                        matchId={match.id}
                        a={{ name: nameOf(match.entry_a), bet: match.bet_a, payout: match.payout_a }}
                        b={{ name: nameOf(match.entry_b), bet: match.bet_b, payout: match.payout_b }}
                        locked={false}
                      />
                    ) : (
                      <p className="text-sm text-subtle">
                        {match.entry_a ? nameOf(match.entry_a) : "Por definir"} vs{" "}
                        {match.entry_b ? nameOf(match.entry_b) : "por definir"}
                      </p>
                    )}
                    {match.winner_entry_id ? (
                      <p className="mt-2 text-xs text-accent-text">Ganó {nameOf(match.winner_entry_id)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <ActionButton
            action={resetBattle}
            fields={{ battle_id: battle.id }}
            variant="ghost"
            pendingLabel="Borrando…"
            confirmText="¿Borrar el cuadro y todos los resultados? La battle vuelve a «Calls abiertos»."
          >
            Borrar cuadro y volver a empezar
          </ActionButton>
        </section>
      ) : null}

      {battle.status === "draft" || profile.role === "admin" ? (
        <section className="border-t border-line pt-4">
          <ActionButton
            action={deleteBattle}
            fields={{ battle_id: battle.id }}
            variant="ghost"
            pendingLabel="Borrando…"
            confirmText="¿Borrar la battle con sus slots, cruces y calls? No se puede deshacer."
            className="[&_button]:text-live"
          >
            Borrar battle
          </ActionButton>
        </section>
      ) : null}
    </div>
  );
}
