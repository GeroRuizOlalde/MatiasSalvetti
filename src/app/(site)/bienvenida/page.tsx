import { CircleCheck, FileWarning } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentProfile, needsOnboarding, safeNext } from "@/lib/auth/session";
import { getLegalDocument } from "@/lib/legal";
import { AcceptTermsForm } from "./accept-terms-form";

export const metadata: Metadata = {
  title: "Bienvenida",
  robots: { index: false },
};

export default function BienvenidaPage({ searchParams }: PageProps<"/bienvenida">) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="font-marker text-xl text-accent-text">un paso más</p>
      <h1 className="mt-1 font-display text-5xl tracking-wide uppercase">Bienvenido</h1>
      <p className="mt-4 text-muted">
        Antes de participar necesitamos que confirmes tu edad y aceptes las bases. Lo hacés una sola vez (y de nuevo
        solo si las bases cambian).
      </p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-xl bg-surface" />}>
        <Onboarding searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Onboarding({ searchParams }: { searchParams: PageProps<"/bienvenida">["searchParams"] }) {
  const [params, profile, terms] = await Promise.all([searchParams, getCurrentProfile(), getLegalDocument("terms")]);
  const next = safeNext(params.next);
  if (!profile) redirect(`/entrar?next=${encodeURIComponent("/bienvenida")}`);

  if (!terms) {
    return (
      <EmptyState icon={FileWarning} title="Bases sin publicar" className="mt-8">
        Todavía no hay bases y condiciones publicadas. Volvé en un rato.
      </EmptyState>
    );
  }

  if (!needsOnboarding(profile, terms.version)) {
    return (
      <div className="mt-8 flex flex-col items-center gap-4">
        <CircleCheck className="size-10 text-accent-text" aria-hidden />
        <p>Ya está todo listo.</p>
        <Link href={next} className={buttonClasses()}>
          Seguir
        </Link>
      </div>
    );
  }

  return <AcceptTermsForm version={terms.version} next={next} />;
}
