import { AlertTriangle, Clapperboard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ReplayEditButton } from "@/components/replays/replay-edit-button";
import { ReplayViewer } from "@/components/replays/replay-viewer";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatDateTime, formatInteger, formatMoney, formatMulti } from "@/lib/format";
import { matchProvider } from "@/lib/replay-providers";
import { createClient } from "@/lib/supabase/server";
import { AddProviderForm, ProviderActions, ReplayReviewForm } from "./forms";

export const metadata: Metadata = { title: "Replays" };

const TABS = [
  { value: "pending", label: "Por revisar" },
  { value: "approved", label: "Publicados" },
  { value: "rejected", label: "Rechazados" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export default async function PanelReplaysPage({ searchParams }: PageProps<"/panel/replays">) {
  await requirePanelProfile("mod");
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.value === params.estado) ? (params.estado as Tab) : "pending";

  const supabase = await createClient();
  const [{ data: replays, error }, { data: providers }] = await Promise.all([
    supabase
      .from("replays")
      .select(
        "id, url, host, slot_id, slot_name, multi, currency, bet, bonus_cost, payout, likes_count, comments_count, note, status, reject_reason, created_at, user:profiles!replays_user_id_fkey(display_name, twitch_login)",
      )
      .eq("status", tab)
      .order("created_at", { ascending: tab === "pending" })
      .limit(100),
    supabase.from("replay_providers").select("id, name, domain, embeddable").order("name"),
  ]);
  const providerList = providers ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide uppercase">Replays</h1>
        <p className="text-sm text-muted">
          Los viewers comparten links de replays. Se publican en la web cuando los aprobás. Usá «Vista previa» para ver
          si el replay se puede mirar dentro de la página.
        </p>
      </div>

      <section aria-labelledby="replays-list" className="space-y-4">
        <h2 id="replays-list" className="sr-only">
          Replays
        </h2>
        <nav aria-label="Estado" className="flex gap-1">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={`/panel/replays?estado=${t.value}`}
              aria-current={t.value === tab ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-semibold",
                t.value === tab ? "bg-surface-2 text-accent-light" : "text-muted hover:text-text",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {error ? (
          <p role="alert" className="text-sm text-live">
            No se pudieron cargar los replays.
          </p>
        ) : !replays?.length ? (
          <EmptyState icon={Clapperboard} title={tab === "pending" ? "Nada por revisar" : "Sin replays"}>
            {tab === "pending" ? "Los replays nuevos aparecen acá." : null}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {replays.map((replay) => {
              const provider = matchProvider(replay.host, providerList);
              const name = replay.user?.display_name || replay.user?.twitch_login || "Viewer";
              return (
                <li key={replay.id} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {replay.slot_name}
                        {replay.multi !== null ? (
                          <span className="num ml-2 text-gold">{formatMulti(replay.multi)}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-subtle">
                        {name} · {formatDateTime(replay.created_at)}
                        {replay.status === "approved"
                          ? ` · ${formatInteger(replay.likes_count)} me gusta · ${formatInteger(replay.comments_count)} comentarios`
                          : ""}
                      </p>
                      {replay.bet !== null || replay.bonus_cost !== null || replay.payout !== null ? (
                        <p className="num mt-1 text-sm text-muted">
                          {[
                            replay.bet !== null ? `Apuesta ${formatMoney(replay.bet, replay.currency)}` : null,
                            replay.bonus_cost !== null
                              ? `Bono ${formatMoney(replay.bonus_cost, replay.currency)}`
                              : null,
                            replay.payout !== null ? `Pagó ${formatMoney(replay.payout, replay.currency)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        {provider ? (
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-muted">
                            {provider.name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-gold/15 px-1.5 py-0.5 text-xs font-semibold text-gold">
                            <AlertTriangle className="size-3" aria-hidden /> Proveedor desconocido
                          </span>
                        )}
                        <span className="min-w-0 break-all text-muted">{replay.url}</span>
                      </p>
                      {replay.note ? <p className="mt-1 text-sm text-muted">“{replay.note}”</p> : null}
                      {replay.reject_reason ? (
                        <p className="mt-1 text-xs text-subtle">Motivo del rechazo: {replay.reject_reason}</p>
                      ) : null}
                    </div>
                    <ReplayEditButton replay={replay} providers={providerList} byPanel />
                    <ReplayViewer
                      url={replay.url}
                      title={`${replay.slot_name} · ${name}`}
                      embeddable
                      label="Vista previa"
                      variant="secondary"
                    />
                  </div>
                  <ReplayReviewForm replayId={replay.id} status={replay.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="providers" className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <div>
          <h2 id="providers" className="font-semibold">
            Proveedores
          </h2>
          <p className="text-sm text-muted">
            Con el dominio se reconoce de qué proveedor es cada link. Si la vista previa de sus replays se ve bien,
            activá «Se ve en la página»; si queda en blanco o da error, dejalo en «Se abre en otra pestaña».
          </p>
        </div>
        {providerList.length ? (
          <ul className="divide-y divide-line">
            {providerList.map((provider) => (
              <li key={provider.id} className="flex flex-wrap items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{provider.name}</p>
                  <p className="text-xs text-subtle">{provider.domain}</p>
                </div>
                <ProviderActions providerId={provider.id} embeddable={provider.embeddable} />
              </li>
            ))}
          </ul>
        ) : null}
        <AddProviderForm />
      </section>
    </div>
  );
}
