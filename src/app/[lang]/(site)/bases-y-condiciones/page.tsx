import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getI18n, pageLocale } from "@/i18n/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/bases-y-condiciones">): Promise<Metadata> {
  const { t } = getI18n(await pageLocale(params));
  return { title: t.legalPages.terms, description: t.legalPages.termsDescription };
}

export default async function Page({ params }: PageProps<"/[lang]/bases-y-condiciones">) {
  const lang = await pageLocale(params);
  return <LegalPage kind="terms" fallbackTitle={getI18n(lang).t.legalPages.terms} lang={lang} />;
}
