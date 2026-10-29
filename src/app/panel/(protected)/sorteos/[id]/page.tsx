import { ArrowLeft, ExternalLink, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionButton } from "@/components/panel/action-button";
import { requirePanelProfile } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatDateTime, formatInteger, isPast, toArgentinaInput } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { deleteGiveaway, drawGiveaway } from "../actions";
import { GiveawayForm, WinnerStatusForm } from "../forms";
import { casinoOptions } from "@/lib/panel-casinos";

export const metadata: Metadata = { title: "Sorteo" };

export default async function PanelGiveawayPage({ params }: PageProps<"/panel/sorteos/[id]">) {
  await requirePanelProfile("admin");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: giveaway } = await supabase
    .from("giveaways")
    .select(
      "id, title, prize, description, starts_at, ends_at, status, entry_mode, max_tickets_per_user, winners_count, min_level, casino_id, image_path, drawn_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!giveaway) notFound();

  const [{ data: casinos }, { data: stats }, { data: winners }, { data: entries }] = await Promise.all([
    casinoOptions(supabase, giveaway.casino_id),
    supabase.rpc("giveaway_stats", { p_giveaway: id }),
    supabase
      .from("giveaway_winners")
      .select(
        "user_id, position, status, drawn_at, user:profiles!giveaway_winners_user_id_fkey(display_name, twitch_login)",
      )
      .eq("giveaway_id", id)
      .order("position"),
    supabase
      .from("giveaway_entries")
      .select("user_id, entries, created_at, user:profiles!giveaway_entries_user_id_fkey(display_name, twitch_login)")
      .eq("giveaway_id", id)
      .order("entries", { ascending: false })
      .order("created_at")
      .limit(200),
  ]);
  const totals = stats?.[0] ?? { participants: 0, entries: 0 };
  const activeWinners = (winners ?? []).filter((w) => w.status !== "void").length;
  const ended = isPast(giveaway.ends_at);

  return (
    <div className="space-y-6">
      <Link href="/panel/sorteos" className="flex items-center gap-1 text-sm text-subtle hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Sorteos
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-wide uppercase">{giveaway.title}</h1>
        {giveaway.status === "published" ? (
          <Link href="/sorteos" target="_blank" className="flex items-center gap-1 text-sm text-accent-text">
            Ver en la web <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      <section className="flex flex-wrap items-center gap-6 rounded-2xl border border-gold/40 bg-gold/5 p-5">
        <div>
          <p className="text-xs text-subtle">Participantes</p>
          <p className="num text-2xl font-bold text-gold">{formatInteger(totals.participants)}</p>
        </div>
        <div>
          <p className="text-xs text-subtle">Chances</p>
          <p className="num text-2xl font-bold text-gold">{formatInteger(totals.entries)}</p>
        </div>
        <div>
          <p className="text-xs text-subtle">Ganadores</p>
          <p className="num text-2xl font-bold text-gold">
            {formatInteger(activeWinners)}/{formatInteger(giveaway.winners_count)}
          </p>
        </div>
        <div className="ml-auto">
          {giveaway.status !== "published" ? (
            <p className="text-sm text-subtle">Publicalo para poder sortear.</p>
          ) : activeWinners < giveaway.winners_count ? (
            <ActionButton
              action={drawGiveaway}
              fields={{ id: giveaway.id }}
              variant="primary"
              pendingLabel="Sorteando…"
              confirmText={
                ended
                  ? "¿Sortear ahora?"
                  : "El sorteo todavía no cerró: si sorteás ahora, los que se anoten después no van a entrar. ¿Seguir?"
              }
            >
              <Trophy className="size-4" aria-hidden /> Sortear{" "}
              {giveaway.winners_count - activeWinners > 1 ? "ganadores" : "ganador"}
            </ActionButton>
          ) : (
            <p className="text-sm text-accent-text">Sorteo completo ✓</p>
          )}
        </div>
      </section>

      {winners?.length ? (
        <section aria-labelledby="winners" className="space-y-3">
          <h2 id="winners" className="font-semibold">
            Ganadores
          </h2>
          <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {winners.map((winner) => (
              <li key={winner.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="num w-8 text-sm text-subtle">{winner.position}</span>
                <div className={cn("min-w-0 flex-1", winner.status === "void" && "text-subtle line-through")}>
                  <p className="font-semibold">{winner.user?.display_name || winner.user?.twitch_login || "Viewer"}</p>
                  <p className="text-xs text-subtle">
                    {winner.user?.twitch_login ? `twitch.tv/${winner.user.twitch_login} · ` : ""}sorteado{" "}
                    {formatDateTime(winner.drawn_at)}
                  </p>
                </div>
                <WinnerStatusForm giveawayId={giveaway.id} userId={winner.user_id} status={winner.status} />
              </li>
            ))}
          </ol>
          <p className="text-xs text-subtle">
            Si un ganador no responde, anulalo y volvé a sortear: no puede salir dos veces.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="settings" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="settings" className="mb-3 font-semibold">
          Datos del sorteo
        </h2>
        <GiveawayForm
          key={giveaway.updated_at}
          giveaway={{
            ...giveaway,
            startsAt: toArgentinaInput(giveaway.starts_at),
            endsAt: toArgentinaInput(giveaway.ends_at),
          }}
          casinos={casinos ?? []}
        />
      </section>

      <section aria-labelledby="entries" className="space-y-3">
        <h2 id="entries" className="font-semibold">
          Participantes{" "}
          <span className="num text-sm font-normal text-subtle">({formatInteger(totals.participants)})</span>
        </h2>
        {entries?.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
            {entries.map((entry) => (
              <li key={entry.user_id} className="flex items-center gap-4 px-4 py-2">
                <span className="min-w-0 flex-1 truncate">
                  {entry.user?.display_name || entry.user?.twitch_login || "Viewer"}
                </span>
                {giveaway.entry_mode === "tickets" ? (
                  <span className="num text-xs text-gold">{formatInteger(entry.entries)} tickets</span>
                ) : null}
                <span className="text-xs text-subtle">{formatDateTime(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">
            Todavía no se anotó nadie.
          </p>
        )}
      </section>

      <section className="border-t border-line pt-4">
        <ActionButton
          action={deleteGiveaway}
          fields={{ id: giveaway.id }}
          variant="ghost"
          pendingLabel="Borrando…"
          confirmText="¿Borrar el sorteo con sus participantes y ganadores? Los tickets usados no se devuelven."
          className="[&_button]:text-live"
        >
          Borrar sorteo
        </ActionButton>
      </section>
    </div>
  );
}
