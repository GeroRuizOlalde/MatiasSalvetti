import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getI18n, pageLocale } from "@/i18n/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacidad">): Promise<Metadata> {
  const { t } = getI18n(await pageLocale(params));
  return { title: t.legalPages.privacy, description: t.legalPages.privacyDescription };
}

export default async function Page({ params }: PageProps<"/[lang]/privacidad">) {
  const lang = await pageLocale(params);
  return <LegalPage kind="privacy" fallbackTitle={getI18n(lang).t.legalPages.privacy} lang={lang} />;
}
