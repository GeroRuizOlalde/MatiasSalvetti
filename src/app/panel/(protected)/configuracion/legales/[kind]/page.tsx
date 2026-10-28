import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePanelProfile } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { LEGAL_KINDS } from "@/lib/legal-kinds";
import { LegalEditor } from "./legal-editor";

export const metadata: Metadata = { title: "Textos legales" };

export default async function LegalEditPage({ params }: PageProps<"/panel/configuracion/legales/[kind]">) {
  await requirePanelProfile("admin");
  const { kind } = await params;
  const meta = LEGAL_KINDS.find((k) => k.kind === kind);
  if (!meta) notFound();

  const supabase = await createClient();
  const { data: versions } = await supabase
    .from("legal_documents")
    .select("version, title, content_md, published_at")
    .eq("kind", meta.kind)
    .order("version", { ascending: false });
  const latest = versions?.[0];

  return (
    <div className="space-y-6">
      <Link href="/panel/configuracion" className="flex items-center gap-1 text-sm text-subtle hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Configuración
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-wide uppercase">{meta.label}</h1>
        <Link href={meta.href} target="_blank" className="flex items-center gap-1 text-sm text-accent-text">
          Ver en la web <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <LegalEditor
          kind={meta.kind}
          title={latest?.title ?? meta.label}
          content={latest?.content_md ?? ""}
          nextVersion={(latest?.version ?? 0) + 1}
        />
      </section>

      {versions?.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-subtle">Historial</h2>
          <ul className="space-y-1 text-sm text-muted">
            {versions.map((v) => (
              <li key={v.version}>
                Versión <span className="num">{v.version}</span> ·{" "}
                {v.published_at ? formatDate(v.published_at) : "sin publicar"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
