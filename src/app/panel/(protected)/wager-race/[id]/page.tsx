import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionButton } from "@/components/panel/action-button";
import { Avatar } from "@/components/ui/avatar";
import { requirePanelProfile } from "@/lib/auth/session";
import { formatDateTime, formatInteger, formatMoney, toArgentinaInput } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { deleteRace } from "../actions";
import { EntryForm, ImportWagersForm, RaceForm } from "../forms";

export const metadata: Metadata = { title: "Wager Race" };

export default async function PanelRacePage({ params }: PageProps<"/panel/wager-race/[id]">) {
  await requirePanelProfile("admin");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: race } = await supabase
    .from("wager_races")
    .select(
      "id, title, casino_id, currency, starts_at, ends_at, prizes, rules_md, status, wager_updated_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!race) notFound();

  const [{ data: board }, { data: casinos }, { count: verified }] = await Promise.all([
    supabase.rpc("wager_leaderboard", { p_race: id, p_limit: 500 }),
    supabase.from("casinos").select("id, name").order("sort_order").order("name"),
    supabase
      .from("casino_accounts")
      .select("id", { count: "exact", head: true })
      .eq("casino_id", race.casino_id)
      .eq("status", "approved"),
  ]);
  // El ranking devuelve el ID enmascarado; para editar hace falta el de la cuenta.
  const { data: entries } = await supabase
    .from("wager_entries")
    .select("account_id, wager, account:casino_accounts(account_id, user_id)")
    .eq("race_id", id);
  const entryOf = (userId: string) => entries?.find((e) => e.account?.user_id === userId);

  return (
    <div className="space-y-6">
      <Link href="/panel/wager-race" className="flex items-center gap-1 text-sm text-subtle hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Carreras
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-wide uppercase">{race.title}</h1>
        {race.status === "published" ? (
          <Link
            href={`/wager-race/${race.id}`}
            target="_blank"
            className="flex items-center gap-1 text-sm text-accent-text"
          >
            Ver en la web <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      <section aria-labelledby="settings" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="settings" className="mb-3 font-semibold">
          Datos de la carrera
        </h2>
        <RaceForm
          key={race.updated_at}
          race={{ ...race, startsAt: toArgentinaInput(race.starts_at), endsAt: toArgentinaInput(race.ends_at) }}
          casinos={casinos ?? []}
        />
      </section>

      <section aria-labelledby="import" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="import" className="mb-1 font-semibold">
          Cargar wager
        </h2>
        <p className="mb-3 text-xs text-subtle">
          {formatInteger(verified ?? 0)} cuentas verificadas en este casino
          {race.wager_updated_at ? ` · última carga ${formatDateTime(race.wager_updated_at)}` : ""}
        </p>
        <ImportWagersForm raceId={race.id} />
      </section>

      <section aria-labelledby="ranking" className="space-y-3">
        <h2 id="ranking" className="font-semibold">
          Ranking <span className="num text-sm font-normal text-subtle">({formatInteger(board?.length ?? 0)})</span>
        </h2>
        {board?.length ? (
          <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {board.map((row) => {
              const entry = entryOf(row.user_id);
              return (
                <li key={row.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <span className="num w-8 text-sm text-subtle">{row.rank}</span>
                  <Avatar url={row.avatar_url} name={row.display_name} size={24} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{row.display_name}</p>
                    <p className="num text-xs text-subtle">{entry?.account?.account_id ?? row.masked_account}</p>
                  </div>
                  <span className="num w-28 text-right text-sm text-gold">
                    {row.prize !== null ? formatMoney(row.prize, race.currency) : ""}
                  </span>
                  {entry ? <EntryForm raceId={race.id} accountId={entry.account_id} wager={row.wager} /> : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">
            Todavía no hay wager cargado.
          </p>
        )}
      </section>

      <section className="border-t border-line pt-4">
        <ActionButton
          action={deleteRace}
          fields={{ id: race.id }}
          variant="ghost"
          pendingLabel="Borrando…"
          confirmText="¿Borrar la carrera y su ranking? No se puede deshacer."
          className="[&_button]:text-live"
        >
          Borrar carrera
        </ActionButton>
      </section>
    </div>
  );
}
