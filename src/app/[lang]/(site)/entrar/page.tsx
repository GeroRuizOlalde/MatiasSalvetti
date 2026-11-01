import type { Locale } from "@/i18n/config";
import { getI18n, pageLocale } from "@/i18n/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginButton } from "@/components/layout/login-button";
import { getCurrentProfile, safeNext } from "@/lib/auth/session";

export async function generateMetadata({ params }: PageProps<"/[lang]/entrar">): Promise<Metadata> {
  const { t } = getI18n(await pageLocale(params));
  return { title: t.auth.signInTitle, robots: { index: false } };
}

export default async function EntrarPage({ params, searchParams }: PageProps<"/[lang]/entrar">) {
  const lang = await pageLocale(params);
  const { t } = getI18n(lang);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <p className="font-marker text-xl text-accent-text">{t.auth.signInKicker}</p>
      <h1 className="mt-1 font-display text-5xl tracking-wide uppercase">{t.auth.signInTitle}</h1>
      <p className="mt-4 text-muted">{t.auth.signInText}</p>
      <Suspense fallback={<div className="mt-8 h-12 w-full animate-pulse rounded-lg bg-surface-2" />}>
        <LoginBox searchParams={searchParams} lang={lang} />
      </Suspense>
      <p className="mt-6 text-xs text-subtle">{t.auth.adultsOnly}</p>
    </div>
  );
}

async function LoginBox({
  searchParams,
  lang,
}: {
  searchParams: PageProps<"/[lang]/entrar">["searchParams"];
  lang: Locale;
}) {
  const { t, href } = getI18n(lang);
  const params = await searchParams;
  const next = safeNext(params.next, href("/"));
  if (await getCurrentProfile()) redirect(next);

  const error = typeof params.error === "string" ? t.auth.errors[params.error] : undefined;
  return (
    <div className="mt-8 w-full">
      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-live/40 bg-live/10 px-4 py-3 text-sm text-text">
          {error}
        </p>
      ) : null}
      <LoginButton next={next} size="lg" lang={lang} />
    </div>
  );
}
