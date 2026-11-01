"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { DEFAULT_LOCALE, localePath, type Locale } from "./config";
import { MESSAGES } from "./messages";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Idioma de la página para los componentes de cliente. Sin provider (panel) es español. */
export function LocaleProvider({ lang, children }: { lang: Locale; children: ReactNode }) {
  // <html lang> lo pone el layout raíz en español; acá se corrige en inglés.
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "es-AR";
  }, [lang]);
  return <LocaleContext.Provider value={lang}>{children}</LocaleContext.Provider>;
}

/** Textos del idioma actual y cómo armar links dentro de ese idioma. */
export function useI18n() {
  const lang = useContext(LocaleContext);
  return { lang, t: MESSAGES[lang], href: (path: string) => localePath(lang, path) };
}
