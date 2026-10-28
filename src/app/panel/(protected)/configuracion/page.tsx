import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { requirePanelProfile } from "@/lib/auth/session";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { LEGAL_KINDS } from "@/lib/legal-kinds";
import { OVERLAYS } from "@/lib/overlay";
import { getPublicSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { GeneralForm, HomeStatsForm, OverlayTokenForm, SocialsForm } from "./settings-forms";

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  await requirePanelProfile("admin");
  const supabase = await createClient();
  const [settings, tokenRow, legalRows] = await Promise.all([
    getPublicSettings(),
    supabase.from("site_settings").select("value").eq("key", "overlay_token").maybeSingle(),
    supabase.from("legal_documents").select("kind, version, published_at").order("version", { ascending: false }),
  ]);

  const token = typeof tokenRow.data?.value === "string" ? tokenRow.data.value : null;
  const siteUrl = await currentOrigin();
  const latest = new Map<string, { version: number; published_at: string | null }>();
  for (const row of legalRows.data ?? []) if (!latest.has(row.kind)) latest.set(row.kind, row);

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">Configuración</h1>

      <Section title="Redes">
        <SocialsForm socials={settings.socials} primary={settings.primary_platform} />
      </Section>

      <Section
        title="Stats de la Home"
        description="Hunts y mejor multiplicador se calculan solos desde los hunts cargados."
      >
        <HomeStatsForm years={settings.home_stats.years_streaming} prizes={settings.home_stats.monthly_prizes} />
      </Section>

      <Section title="General">
        <GeneralForm
          helpline={settings.responsible_gaming_helpline}
          minAgeDays={settings.twitch_min_account_age_days}
        />
      </Section>

      <Section
        title="Overlays de OBS"
        description="Agregá cada URL como «Fuente de navegador» en OBS (se actualizan solas cada 5 segundos). Si regenerás el token, las URLs viejas dejan de funcionar."
      >
        <OverlayTokenForm token={token} />
        {token ? (
          <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
            {OVERLAYS.map((overlay) => (
              <li key={overlay.path} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{overlay.label}</p>
                  <p className="text-xs text-subtle">
                    {overlay.description} Fuente de navegador de {overlay.size}.
                  </p>
                </div>
                <code className="num text-xs text-muted">/overlay/{overlay.path}?key=•••</code>
                <CopyButton
                  value={`${siteUrl}/overlay/${overlay.path}?key=${token}`}
                  label={`Copiar URL del overlay de ${overlay.label}`}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="Textos legales" description="Cada cambio se publica como versión nueva y queda el historial.">
        <ul className="divide-y divide-line">
          {LEGAL_KINDS.map(({ kind, label }) => {
            const doc = latest.get(kind);
            return (
              <li key={kind} className="flex flex-wrap items-center gap-3 py-3">
                <FileText className="size-5 text-accent-text" aria-hidden />
                <span className="font-semibold">{label}</span>
                <span className="text-sm text-subtle">
                  {doc
                    ? `Versión ${doc.version}${doc.published_at ? ` · ${formatDate(doc.published_at)}` : " · sin publicar"}`
                    : "Sin versiones"}
                </span>
                <Link
                  href={`/panel/configuracion/legales/${kind}`}
                  className="ml-auto text-sm font-semibold text-accent-text hover:text-accent-light"
                >
                  Editar
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

/**
 * Dirección desde la que se abrió el panel, para que las URLs de los overlays
 * sirvan aunque falte NEXT_PUBLIC_SITE_URL o se use otro dominio.
 */
async function currentOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return publicEnv.NEXT_PUBLIC_SITE_URL;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-2xl tracking-wide uppercase">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
