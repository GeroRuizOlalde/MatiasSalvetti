import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, LOCALES, localePath } from "@/i18n/config";
import { LocaleProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";

// Solo /es (las URLs sin prefijo, que el proxy reescribe) y /en.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { t } = getI18n(lang);
  return {
    description: t.meta.description,
    alternates: { languages: { es: localePath("es", "/"), en: localePath("en", "/") } },
  };
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LocaleProvider lang={lang}>{children}</LocaleProvider>;
}
