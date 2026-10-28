import { ArrowLeft, ExternalLink, Trash2, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionButton } from "@/components/panel/action-button";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePanelProfile } from "@/lib/auth/session";
import { groupRounds, VALID_ENTRY_COUNTS } from "@/lib/calc/bracket";
import { formatInteger } from "@/lib/format";
import { BATTLE_STATUSES, statusInfo } from "@/lib/session-status";
import { createClient } from "@/lib/supabase/server";
import { deleteBattle, deleteEntry, resetBattle, shuffleEntries, startBattle } from "../actions";
import { AddEntryForm, BattleForm, MatchForm } from "../forms";

export const metadata: Metadata = { title: "Bonus Battle" };

export default async function PanelBattlePage({ params }: PageProps<"/panel/battles/[id]">) {
  const profile = await requirePanelProfile("mod");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: battle } = await supabase
    .from("battles")
    .select("id, title, casino_id, currency, status, winner_entry_id, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!battle) notFound();

  const [{ data: entries }, { data: matches }, { data: counts }, { data: casinos }] = await Promise.all([
    supabase
      .from("battle_entries")
      .select("id, seed, slot_name, provider")
      .eq("battle_id", id)
      .order("seed")
      .order("created_at"),
    supabase
      .from("battle_matches")
      .select("id, round, slot, entry_a, entry_b, bet_a, payout_a, bet_b, payout_b, winner_entry_id")
      .eq("battle_id", id),
    supabase.rpc("battle_pick_counts", { p_battle: id }),
    supabase.from("casinos").select("id, name").order("sort_order").order("name"),
  ]);

  const list = entries ?? [];
  const picks = new Map((counts ?? []).map((c) => [c.entry_id, c.picks]));
  const nameOf = (entryId: string | null) => list.find((e) => e.id === entryId)?.slot_name ?? "Por definir";
  const started = battle.status === "live" || battle.status === "finished";
  const status = statusInfo(BATTLE_STATUSES, battle.status);
  const rounds = groupRounds(matches ?? []);
  const canStart = VALID_ENTRY_COUNTS.includes(list.length);

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
          <strong className="text-gold">{nameOf(battle.winner_entry_id)}</strong> · lo bancaron{" "}
          {formatInteger(picks.get(battle.winner_entry_id ?? "") ?? 0)} viewers.
        </p>
      ) : null}

      <section aria-labelledby="settings" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="settings" className="mb-3 font-semibold">
          Datos de la battle
        </h2>
        <BattleForm key={battle.updated_at} battle={battle} casinos={casinos ?? []} />
      </section>

      <section aria-labelledby="entries" className="space-y-3">
        <h2 id="entries" className="font-semibold">
          Slots <span className="num text-sm font-normal text-subtle">({formatInteger(list.length)})</span>
        </h2>
        {started ? null : (
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
                  <p className="truncate text-xs text-subtle">{entry.provider ?? "Sin proveedor"}</p>
                </div>
                <span className="num text-sm text-muted">{formatInteger(picks.get(entry.id) ?? 0)} picks</span>
                {started ? null : (
                  <ActionButton
                    action={deleteEntry}
                    fields={{ id: entry.id, battle_id: battle.id }}
                    variant="ghost"
                    pendingLabel="…"
                    confirmText={`¿Quitar ${entry.slot_name}? Se borran sus picks.`}
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
              Los cruces de la primera ronda salen del orden: 1 contra 2, 3 contra 4… Arrancar cierra el «bancá a tu
              slot».
              {canStart ? "" : " Hacen falta 2, 4, 8 o 16 slots."}
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
                confirmText="¿Arrancar la battle? Se cierra el «bancá a tu slot» y se arma el cuadro."
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
            confirmText="¿Borrar el cuadro y todos los resultados? La battle vuelve a «Bancá a tu slot»."
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
            confirmText="¿Borrar la battle con sus slots, cruces y picks? No se puede deshacer."
            className="[&_button]:text-live"
          >
            Borrar battle
          </ActionButton>
        </section>
      ) : null}
    </div>
  );
}
