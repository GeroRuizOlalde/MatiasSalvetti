import { Gift } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePanelProfile } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { GiveawayForm } from "./forms";

export const metadata: Metadata = { title: "Sorteos" };

export default async function PanelSorteosPage() {
  await requirePanelProfile("admin");
  const supabase = await createClient();
  const [{ data: giveaways, error }, { data: casinos }] = await Promise.all([
    supabase
      .from("giveaways")
      .select("id, title, prize, status, ends_at, drawn_at")
      .order("ends_at", { ascending: false })
      .limit(100),
    supabase.from("casinos").select("id, name").order("sort_order").order("name"),
  ]);

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">Sorteos</h1>
      <section aria-labelledby="new-giveaway" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="new-giveaway" className="mb-3 font-semibold">
          Nuevo sorteo
        </h2>
        <GiveawayForm casinos={casinos ?? []} />
      </section>

      {error ? (
        <p role="alert" className="text-sm text-live">
          No se pudieron cargar los sorteos.
        </p>
      ) : !giveaways?.length ? (
        <EmptyState icon={Gift} title="Sin sorteos">
          Creá el primero con el formulario de arriba.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {giveaways.map((giveaway) => (
            <li key={giveaway.id}>
              <Link
                href={`/panel/sorteos/${giveaway.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2"
              >
                <span className="font-semibold">{giveaway.title}</span>
                <StatusPill
                  label={giveaway.status === "published" ? (giveaway.drawn_at ? "Sorteado" : "Publicado") : "Borrador"}
                  tone={giveaway.status === "published" ? (giveaway.drawn_at ? "done" : "live") : "muted"}
                />
                <span className="text-sm text-gold">{giveaway.prize}</span>
                <span className="ml-auto text-xs text-subtle">Cierra {formatDateTime(giveaway.ends_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
