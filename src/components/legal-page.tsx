import { FileText } from "lucide-react";
import Markdown from "react-markdown";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/format";
import { getLegalDocument } from "@/lib/legal";
import { getPublicSettings } from "@/lib/settings";
import type { Enums } from "@/types/database";

export async function LegalPage({ kind, fallbackTitle }: { kind: Enums<"legal_kind">; fallbackTitle: string }) {
  const [doc, settings] = await Promise.all([getLegalDocument(kind), getPublicSettings()]);

  if (!doc) {
    return (
      <>
        <PageHeader title={fallbackTitle} />
        <div className="mx-auto max-w-3xl px-4 pb-16">
          <EmptyState icon={FileText} title="Sin contenido">
            Este documento todavía no está cargado.
          </EmptyState>
        </div>
      </>
    );
  }

  const content = doc.content_md.replaceAll("{{helpline}}", settings.responsible_gaming_helpline);

  return (
    <>
      <PageHeader title={doc.title}>
        <p className="text-sm text-subtle">
          Versión <span className="num">{doc.version}</span>
          {doc.published_at ? <> · vigente desde el {formatDate(doc.published_at)}</> : null}
        </p>
      </PageHeader>
      <article className="mx-auto max-w-3xl px-4 pb-16 text-muted [&_a]:text-accent-text [&_a]:underline [&_blockquote]:my-6 [&_blockquote]:rounded-xl [&_blockquote]:border [&_blockquote]:border-gold/40 [&_blockquote]:bg-gold/5 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:text-gold [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:tracking-wide [&_h2]:text-text [&_h2]:uppercase [&_li]:my-1 [&_p]:my-4 [&_p]:leading-relaxed [&_strong]:text-text [&_ul]:list-disc [&_ul]:pl-6">
        <Markdown>{content}</Markdown>
      </article>
    </>
  );
}
