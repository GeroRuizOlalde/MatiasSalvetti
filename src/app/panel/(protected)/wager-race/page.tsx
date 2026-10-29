import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePanelProfile } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { RaceForm } from "./forms";
import { casinoOptions } from "@/lib/panel-casinos";

export const metadata: Metadata = { title: "Wager Race" };

export default async function PanelWagerPage() {
  await requirePanelProfile("admin");
  const supabase = await createClient();
  const [{ data: races, error }, { data: casinos }, { count: pending }] = await Promise.all([
    supabase
      .from("wager_races")
      .select("id, title, status, starts_at, ends_at, casino:casinos(name)")
      .order("starts_at", { ascending: false })
      .limit(100),
    casinoOptions(supabase),
    supabase.from("casino_accounts").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">Wager Race</h1>
      {pending ? (
        <p className="text-sm">
          Hay <strong className="text-gold">{pending}</strong> cuentas de casino esperando verificación.{" "}
          <Link href="/panel/verificaciones" className="font-semibold text-accent-text underline">
            Revisarlas
          </Link>
        </p>
      ) : null}

      <section aria-labelledby="new-race" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="new-race" className="mb-3 font-semibold">
          Nueva carrera
        </h2>
        <RaceForm casinos={casinos ?? []} />
      </section>

      {error ? (
        <p role="alert" className="text-sm text-live">
          No se pudieron cargar las carreras.
        </p>
      ) : !races?.length ? (
        <EmptyState icon={Trophy} title="Sin carreras">
          Creá la primera con el formulario de arriba.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {races.map((race) => (
            <li key={race.id}>
              <Link
                href={`/panel/wager-race/${race.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2"
              >
                <span className="font-semibold">{race.title}</span>
                <StatusPill
                  label={race.status === "published" ? "Publicada" : "Borrador"}
                  tone={race.status === "published" ? "done" : "muted"}
                />
                <span className="text-sm text-subtle">{race.casino?.name}</span>
                <span className="ml-auto text-xs text-subtle">
                  {formatDateTime(race.starts_at)} → {formatDateTime(race.ends_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
