import { ArrowLeft, ExternalLink, Inbox, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { HuntStatsGrid } from "@/components/hunts/hunt-stats";
import { HuntStatusBadge } from "@/components/hunts/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { huntStats } from "@/lib/calc/hunt";
import { formatDateTime, formatInteger, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { DeleteHuntForm, HuntForm } from "../hunt-form";
import { AddBonusForm, BonusRowForm, CallReviewForm } from "./bonus-forms";

export const metadata: Metadata = { title: "Bonus Hunt" };

export default async function PanelHuntPage({ params }: PageProps<"/panel/hunts/[id]">) {
  const profile = await requirePanelProfile("mod");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: hunt } = await supabase
    .from("hunts")
    .select(
      "id, title, casino_id, currency, start_cost, status, calls_open, guesses_open, final_balance, gtb_winner_id, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!hunt) notFound();

  const [{ data: bonuses }, { data: calls }, { data: casinos }, { data: guessCount }] = await Promise.all([
    supabase
      .from("hunt_bonuses")
      .select("id, position, slot_name, provider, bet, payout, called_by")
      .eq("hunt_id", id)
      .order("position")
      .order("created_at"),
    supabase
      .from("hunt_calls")
      .select("id, user_id, slot_name, created_at")
      .eq("hunt_id", id)
      .eq("status", "pending")
      .order("created_at"),
    supabase.from("casinos").select("id, name").order("sort_order").order("name"),
    supabase.rpc("hunt_guess_count", { p_hunt: id }),
  ]);

  const userIds = [
    ...(bonuses ?? []).map((b) => b.called_by),
    ...(calls ?? []).map((c) => c.user_id),
    hunt.gtb_winner_id,
  ];
  const ids = [...new Set(userIds.filter((u): u is string => Boolean(u)))];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, display_name, twitch_login").in("id", ids)
    : { data: [] };
  const nameOf = (userId: string | null) => {
    const p = people?.find((x) => x.id === userId);
    return p ? p.display_name || p.twitch_login || "Viewer" : null;
  };

  const list = bonuses ?? [];
  const stats = huntStats(hunt.start_cost, list);
  const locked = hunt.status === "finished";
  const lastBet = list.at(-1)?.bet;

  return (
    <div className="max-w-6xl space-y-6">
      <Link href="/panel/hunts" className="flex items-center gap-1 text-sm text-subtle hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Hunts
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-wide uppercase">{hunt.title}</h1>
        <HuntStatusBadge status={hunt.status} />
        {hunt.status !== "draft" ? (
          <Link
            href={`/bonus-hunt/${hunt.id}`}
            target="_blank"
            className="flex items-center gap-1 text-sm text-accent-text"
          >
            Ver en la web <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      <HuntStatsGrid
        stats={stats}
        startCost={hunt.start_cost}
        currency={hunt.currency}
        finalBalance={hunt.final_balance}
      />

      <section aria-labelledby="settings" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="settings" className="mb-3 font-semibold">
          Datos del hunt
        </h2>
        <HuntForm key={hunt.updated_at} hunt={hunt} casinos={casinos ?? []} />
      </section>

      {hunt.status === "finished" ? (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gold/5 p-5">
          <Trophy className="size-6 text-gold" aria-hidden />
          <p className="text-sm">
            Balance final{" "}
            <strong className="num text-gold">{formatMoney(hunt.final_balance ?? 0, hunt.currency)}</strong>.{" "}
            {hunt.gtb_winner_id ? (
              <>
                Ganó el GTB <strong>{nameOf(hunt.gtb_winner_id)}</strong> ({formatInteger(guessCount ?? 0)} apuestas).
              </>
            ) : (
              "Nadie apostó en el GTB."
            )}
          </p>
        </section>
      ) : null}

      <section aria-labelledby="calls">
        <h2 id="calls" className="mb-3 flex items-center gap-2 font-semibold">
          Calls por revisar
          <span className="num rounded-full bg-surface-2 px-2 text-xs text-muted">
            {formatInteger(calls?.length ?? 0)}
          </span>
          {!hunt.calls_open ? <span className="text-xs font-normal text-subtle">(calls cerrados)</span> : null}
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
                {locked ? null : <CallReviewForm huntId={hunt.id} callId={call.id} defaultBet={lastBet} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">
            No hay calls pendientes.
          </p>
        )}
      </section>

      <section aria-labelledby="bonuses" className="space-y-3">
        <h2 id="bonuses" className="font-semibold">
          Bonos <span className="num text-sm font-normal text-subtle">({formatInteger(list.length)})</span>
        </h2>
        {locked ? null : (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <AddBonusForm huntId={hunt.id} defaultBet={lastBet} />
          </div>
        )}
        {list.length ? (
          <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {list.map((bonus, i) => (
              <li
                key={`${bonus.id}-${bonus.bet}-${bonus.payout}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
              >
                <span className="num w-8 text-sm text-subtle">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{bonus.slot_name}</p>
                  <p className="truncate text-xs text-subtle">
                    {bonus.provider ?? "Sin proveedor"}
                    {bonus.called_by ? ` · call de ${nameOf(bonus.called_by) ?? "un viewer"}` : ""}
                  </p>
                </div>
                <BonusRowForm huntId={hunt.id} bonus={bonus} locked={locked} />
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon={Inbox} title="Sin bonos">
            Cargá los bonos a medida que caen, o aceptá los calls de los viewers.
          </EmptyState>
        )}
      </section>

      {hunt.status === "draft" || profile.role === "admin" ? (
        <section className="border-t border-line pt-4">
          <DeleteHuntForm huntId={hunt.id} />
        </section>
      ) : null}
    </div>
  );
}
