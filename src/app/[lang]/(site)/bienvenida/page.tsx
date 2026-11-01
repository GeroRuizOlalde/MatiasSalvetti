import type { Locale } from "@/i18n/config";
import { getI18n, pageLocale } from "@/i18n/server";
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

export async function generateMetadata({ params }: PageProps<"/[lang]/bienvenida">): Promise<Metadata> {
  const { t } = getI18n(await pageLocale(params));
  return { title: t.auth.welcomeMeta, robots: { index: false } };
}

export default async function BienvenidaPage({ params, searchParams }: PageProps<"/[lang]/bienvenida">) {
  const lang = await pageLocale(params);
  const { t } = getI18n(lang);
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="font-marker text-xl text-accent-text">{t.auth.welcomeKicker}</p>
      <h1 className="mt-1 font-display text-5xl tracking-wide uppercase">{t.auth.welcomeTitle}</h1>
      <p className="mt-4 text-muted">{t.auth.welcomeText}</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-xl bg-surface" />}>
        <Onboarding searchParams={searchParams} lang={lang} />
      </Suspense>
    </div>
  );
}

async function Onboarding({
  searchParams,
  lang,
}: {
  searchParams: PageProps<"/[lang]/bienvenida">["searchParams"];
  lang: Locale;
}) {
  const { t, href } = getI18n(lang);
  const [params, profile, terms] = await Promise.all([searchParams, getCurrentProfile(), getLegalDocument("terms")]);
  const next = safeNext(params.next, href("/"));
  if (!profile) redirect(`${href("/entrar")}?next=${encodeURIComponent(href("/bienvenida"))}`);

  if (!terms) {
    return (
      <EmptyState icon={FileWarning} title={t.auth.noTermsTitle} className="mt-8">
        {t.auth.noTerms}
      </EmptyState>
    );
  }

  if (!needsOnboarding(profile, terms.version)) {
    return (
      <div className="mt-8 flex flex-col items-center gap-4">
        <CircleCheck className="size-10 text-accent-text" aria-hidden />
        <p>{t.auth.allSet}</p>
        <Link href={next} className={buttonClasses()}>
          {t.auth.continue}
        </Link>
      </div>
    );
  }

  return <AcceptTermsForm version={terms.version} next={next} />;
}
