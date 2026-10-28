import { BadgeCheck, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { VERIFICATIONS_BUCKET } from "@/lib/uploads";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Verificaciones" };

const TABS = [
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Aprobadas" },
  { value: "rejected", label: "Rechazadas" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export default async function VerificacionesPage({ searchParams }: PageProps<"/panel/verificaciones">) {
  await requirePanelProfile("admin");
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.value === params.estado) ? (params.estado as Tab) : "pending";

  const supabase = await createClient();
  const { data: accounts, error } = await supabase
    .from("casino_accounts")
    .select(
      "id, account_id, status, reject_reason, screenshot_path, created_at, reviewed_at, casino:casinos(name), user:profiles!casino_accounts_user_id_fkey(display_name, twitch_login, twitch_created_at, created_at)",
    )
    .eq("status", tab)
    .order("created_at", { ascending: tab === "pending" })
    .limit(100);

  // Links firmados (10 minutos) a las capturas del bucket privado.
  const paths = (accounts ?? []).map((a) => a.screenshot_path).filter((p): p is string => Boolean(p));
  const { data: signed } = paths.length
    ? await supabase.storage.from(VERIFICATIONS_BUCKET).createSignedUrls(paths, 600)
    : { data: [] };
  const urlOf = (path: string | null) => signed?.find((s) => s.path === path)?.signedUrl ?? null;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">Verificaciones</h1>
      <p className="text-sm text-muted">
        Revisá que la captura muestre el mismo ID y que la cuenta se haya creado con el link de Matías. Solo las cuentas
        aprobadas suman en la Wager Race.
      </p>

      <nav aria-label="Estado" className="flex gap-1">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/panel/verificaciones?estado=${t.value}`}
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
          No se pudieron cargar las verificaciones.
        </p>
      ) : !accounts?.length ? (
        <EmptyState icon={BadgeCheck} title={tab === "pending" ? "Nada por revisar" : "Sin cuentas"}>
          {tab === "pending" ? "Las verificaciones nuevas aparecen acá." : null}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {accounts.map((account) => {
            const url = urlOf(account.screenshot_path);
            const name = account.user?.display_name || account.user?.twitch_login || "Viewer";
            return (
              <li
                key={account.id}
                className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:flex-row"
              >
                {url ? (
                  <a href={url} target="_blank" rel="noopener" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- link firmado y temporal, no pasa por next/image */}
                    <img src={url} alt={`Captura de ${name}`} className="h-32 w-48 rounded-lg object-cover" />
                  </a>
                ) : (
                  <div className="flex h-32 w-48 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-xs text-subtle">
                    Sin captura
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold">{name}</span>
                    {account.user?.twitch_login ? (
                      <a
                        href={`https://www.twitch.tv/${account.user.twitch_login}`}
                        target="_blank"
                        rel="noopener"
                        className="flex items-center gap-1 text-xs text-accent-text"
                      >
                        twitch.tv/{account.user.twitch_login} <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : null}
                  </p>
                  <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="inline text-subtle">Casino: </dt>
                      <dd className="inline font-semibold">{account.casino?.name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline text-subtle">ID: </dt>
                      <dd className="num inline font-semibold">{account.account_id}</dd>
                    </div>
                    <div>
                      <dt className="inline text-subtle">Enviada: </dt>
                      <dd className="inline">{formatDateTime(account.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="inline text-subtle">Cuenta de Twitch: </dt>
                      <dd className="inline">
                        {account.user?.twitch_created_at ? formatDate(account.user.twitch_created_at) : "sin dato"}
                      </dd>
                    </div>
                  </dl>
                  {account.status === "rejected" && account.reject_reason ? (
                    <p className="text-xs text-live">Motivo: {account.reject_reason}</p>
                  ) : null}
                  <ReviewForm accountId={account.id} status={account.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
