import type { Metadata } from "next";
import Image from "next/image";
import { requirePanelProfile } from "@/lib/auth/session";
import { publicAssetUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { CatalogTabs } from "../catalog-tabs";
import { CasinoForm } from "./casino-form";

export const metadata: Metadata = { title: "Casinos" };

export default async function CatalogoCasinosPage() {
  await requirePanelProfile("admin");
  const supabase = await createClient();
  const { data: casinos, error } = await supabase
    .from("casinos")
    .select("id, name, slug, referral_url, code, sort_order, is_active, logo_path")
    .order("sort_order")
    .order("name");

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">Catálogo</h1>
      <CatalogTabs active="casinos" isAdmin />

      {error ? (
        <p role="alert" className="text-sm text-live">
          No se pudieron cargar los casinos.
        </p>
      ) : (
        <ul className="space-y-4">
          {casinos?.map((casino) => {
            const logo = publicAssetUrl(casino.logo_path);
            return (
              <li key={casino.id} className="rounded-2xl border border-line bg-surface p-5">
                <div className="mb-4 flex items-center gap-3">
                  {logo ? (
                    <Image src={logo} alt="" width={96} height={40} className="h-8 w-auto object-contain" />
                  ) : null}
                  <h2 className="font-display text-2xl tracking-wide uppercase">{casino.name}</h2>
                  {!casino.is_active ? (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-subtle">Inactivo</span>
                  ) : null}
                </div>
                <CasinoForm casino={casino} />
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="new-casino" className="rounded-2xl border border-dashed border-line-strong p-5">
        <h2 id="new-casino" className="mb-4 font-semibold">
          Nuevo casino
        </h2>
        <CasinoForm />
      </section>
    </div>
  );
}
