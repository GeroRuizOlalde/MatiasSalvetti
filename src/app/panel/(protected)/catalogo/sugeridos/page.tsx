import { Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { formatDateTime, formatInteger } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CatalogTabs } from "../catalog-tabs";
import { SuggestionForm } from "./suggestion-form";

export const metadata: Metadata = { title: "Slots sugeridos" };

const SOURCE = { hunt: "Bonus Hunt", buy: "Bonus Buy", battle: "Bonus Battle" } as const;
const STATUS = { added: "Agregado", dismissed: "Descartado", pending: "Pendiente" } as const;
const PROVIDERS_LIST = "providers-list";

export default async function SlotSuggestionsPage() {
  const profile = await requirePanelProfile("mod");
  const supabase = await createClient();
  const columns =
    "id, name, provider, times, source, status, updated_at, created_at, suggester:profiles!slot_suggestions_suggested_by_fkey(display_name, twitch_login)";
  const [{ data: pending, error }, { data: reviewed }, { data: providerRows }] = await Promise.all([
    supabase
      .from("slot_suggestions")
      .select(columns)
      .eq("status", "pending")
      .order("times", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("slot_suggestions")
      .select(columns)
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(20),
    supabase.from("slots").select("provider").not("provider", "is", null).limit(5000),
  ]);
  const providers = [...new Set((providerRows ?? []).map((r) => r.provider as string))].sort();
  const nameOf = (s: { suggester: { display_name: string | null; twitch_login: string | null } | null }) =>
    s.suggester?.display_name || s.suggester?.twitch_login || "Viewer";

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">Catálogo</h1>
      <CatalogTabs active="suggested" isAdmin={profile.role === "admin"} />
      <p className="text-sm text-muted">
        Slots que los viewers pidieron en sus calls y no estaban en el catálogo. Corregí el nombre si hace falta, poné
        el proveedor y agregalo: los calls y bonos con ese nombre quedan vinculados al slot.
      </p>

      <datalist id={PROVIDERS_LIST}>
        {providers.map((provider) => (
          <option key={provider} value={provider} />
        ))}
      </datalist>

      {error ? (
        <p role="alert" className="text-sm text-live">
          No se pudieron cargar las sugerencias.
        </p>
      ) : !pending?.length ? (
        <EmptyState icon={Lightbulb} title="Nada por revisar">
          Cuando un viewer pida un slot que no está en el catálogo, aparece acá.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {pending.map((suggestion) => (
            <li key={suggestion.id} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs text-subtle">
                <span className="num font-semibold text-gold">
                  Pedido {formatInteger(suggestion.times)} {suggestion.times === 1 ? "vez" : "veces"}
                </span>{" "}
                · primero en {SOURCE[suggestion.source]} por {nameOf(suggestion)} ·{" "}
                {formatDateTime(suggestion.created_at)}
              </p>
              <SuggestionForm suggestion={suggestion} providersListId={PROVIDERS_LIST} />
            </li>
          ))}
        </ul>
      )}

      {reviewed?.length ? (
        <section aria-labelledby="reviewed" className="space-y-2">
          <h2 id="reviewed" className="font-semibold">
            Últimas revisadas
          </h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
            {reviewed.map((suggestion) => (
              <li key={suggestion.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                <span className="font-semibold">{suggestion.name}</span>
                <span className="text-subtle">{suggestion.provider ?? "Sin proveedor"}</span>
                <span
                  className={
                    suggestion.status === "added" ? "ml-auto text-xs text-accent-text" : "ml-auto text-xs text-subtle"
                  }
                >
                  {STATUS[suggestion.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
