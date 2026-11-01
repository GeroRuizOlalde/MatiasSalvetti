import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, localePath, LOCALE_COOKIE, type Locale } from "./config";
import { MESSAGES } from "./messages";

/** Textos y links de un idioma, para componentes de servidor (reciben `lang` por props). */
export function getI18n(lang: Locale) {
  return { lang, t: MESSAGES[lang], href: (path: string) => localePath(lang, path) };
}

/** Idioma en Server Actions y route handlers: el de la última página vista (cookie del proxy). */
export async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Textos del idioma de la página desde la que se llamó una Server Action. */
export async function getActionMessages() {
  return MESSAGES[await getRequestLocale()];
}

/** Idioma de una página a partir de sus params (`/[lang]/...`). */
export async function pageLocale(params: Promise<{ lang: string }>): Promise<Locale> {
  const { lang } = await params;
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}
