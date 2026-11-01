// Idiomas de la web pública. El español va sin prefijo (las URLs de siempre) y el
// inglés con /en adelante. El panel y los overlays quedan solo en español.

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

/** Cookie con el último idioma visto: la leen las Server Actions para los mensajes. */
export const LOCALE_COOKIE = "lang";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** "/bonus-hunt" -> "/en/bonus-hunt" en inglés; en español queda igual. */
export function localePath(lang: Locale, path: string) {
  if (lang === DEFAULT_LOCALE || !path.startsWith("/")) return path;
  return path === "/" ? "/en" : `/en${path}`;
}

/** "/en/bonus-hunt" -> { lang: "en", path: "/bonus-hunt" }. */
export function splitLocale(pathname: string): { lang: Locale; path: string } {
  if (pathname === "/en" || pathname.startsWith("/en/")) return { lang: "en", path: pathname.slice(3) || "/" };
  return { lang: DEFAULT_LOCALE, path: pathname };
}

/**
 * Ruta sin idioma, venga como venga: en el navegador las páginas de español pueden
 * aparecer con su ruta interna (/es/...) además de la pública.
 */
export function routePath(pathname: string) {
  if (pathname === "/es" || pathname.startsWith("/es/")) return pathname.slice(3) || "/";
  return splitLocale(pathname).path;
}

/** Para fechas con Intl. */
export const INTL_LOCALE: Record<Locale, string> = { es: "es-AR", en: "en-US" };
