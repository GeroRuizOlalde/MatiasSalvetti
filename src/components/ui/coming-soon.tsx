import { Construction } from "lucide-react";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

/** Página pública que todavía no se construyó (se completa en la fase indicada). */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title}>{description}</PageHeader>
      <div className="mx-auto max-w-7xl px-4 pb-16">
        <EmptyState icon={Construction} title="Muy pronto">
          Estamos armando esta sección. Mientras tanto, seguí el stream en vivo.
        </EmptyState>
      </div>
    </>
  );
}
