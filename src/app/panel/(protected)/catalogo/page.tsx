import { ChevronLeft, ChevronRight, Layers, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { formatInteger } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CatalogTabs } from "./catalog-tabs";
import { ImportSlotsForm, SlotReportImport } from "./import-form";
import { SlotForm } from "./slot-form";

export const metadata: Metadata = { title: "Catálogo de slots" };

const PAGE_SIZE = 50;

export default async function CatalogoSlotsPage({ searchParams }: PageProps<"/panel/catalogo">) {
  const profile = await requirePanelProfile("mod");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 60) : "";
  const page = Math.max(1, Number(params.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("slots")
    .select("id, name, provider, is_active, image_path", { count: "exact" })
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) {
    const pattern = `%${q.replace(/[%_,()]/g, "")}%`;
    query = query.or(`name.ilike.${pattern},provider.ilike.${pattern}`);
  }
  const { data: slots, count, error } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageHref = (p: number) => `/panel/catalogo?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">Catálogo</h1>
      <CatalogTabs active="slots" isAdmin={profile.role === "admin"} />

      <section aria-labelledby="new-slot" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="new-slot" className="mb-3 font-semibold">
          Agregar slot
        </h2>
        <SlotForm />
      </section>

      <details className="rounded-2xl border border-line bg-surface p-5" open={(count ?? 0) === 0 && !q}>
        <summary className="cursor-pointer font-semibold">Importar desde slot.report</summary>
        <div className="mt-4">
          <SlotReportImport />
        </div>
      </details>

      <details className="rounded-2xl border border-line bg-surface p-5">
        <summary className="cursor-pointer font-semibold">Importar slots desde CSV</summary>
        <div className="mt-4">
          <ImportSlotsForm />
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form role="search" className="flex max-w-md flex-1 gap-2">
          <label htmlFor="q" className="sr-only">
            Buscar slot o proveedor
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Buscar slot o proveedor"
            className="h-10 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm"
          />
          <button type="submit" className={buttonClasses({ size: "sm", className: "h-10" })}>
            <Search className="size-4" aria-hidden /> Buscar
          </button>
        </form>
        <p className="text-sm text-subtle">
          <span className="num">{formatInteger(count ?? 0)}</span> slots
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-live">
          No se pudo cargar el catálogo.
        </p>
      ) : !slots?.length ? (
        <EmptyState icon={Layers} title={q ? "Sin resultados" : "Catálogo vacío"}>
          {q ? `Ningún slot coincide con "${q}".` : "Agregá slots a mano o importá un CSV."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {slots.map((slot) => (
            <li key={slot.id}>
              <details className="group px-4 py-3">
                <summary className="flex cursor-pointer items-center gap-3">
                  <span className={slot.is_active ? "font-semibold" : "font-semibold text-subtle line-through"}>
                    {slot.name}
                  </span>
                  <span className="text-sm text-subtle">{slot.provider ?? "Sin proveedor"}</span>
                  {slot.image_path ? <span className="text-xs text-accent-text">con imagen</span> : null}
                  <span className="ml-auto text-xs text-subtle group-open:hidden">Editar</span>
                </summary>
                <div className="mt-3">
                  <SlotForm slot={slot} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <ChevronLeft className="size-4" aria-hidden /> Anterior
            </Link>
          ) : null}
          <span className="num text-sm text-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Siguiente <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
