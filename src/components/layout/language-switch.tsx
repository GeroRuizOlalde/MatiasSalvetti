"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { localePath, routePath, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";

const OPTIONS: { lang: Locale; label: string; name: string }[] = [
  { lang: "es", label: "ESP", name: "Español" },
  { lang: "en", label: "ENG", name: "English" },
];

/** ESP / ENG: lleva a la misma página en el otro idioma. */
export function LanguageSwitch() {
  return (
    // usePathname() en rutas dinámicas necesita un Suspense para prerenderizar.
    <Suspense fallback={<Switch path="/" />}>
      <SwitchWithPath />
    </Suspense>
  );
}

function SwitchWithPath() {
  return <Switch path={routePath(usePathname())} />;
}

function Switch({ path }: { path: string }) {
  const { lang, t } = useI18n();
  return (
    <nav
      aria-label={t.layout.language}
      className="flex h-9 w-fit items-center rounded-full border border-line bg-surface p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = option.lang === lang;
        return (
          <a
            key={option.lang}
            href={localePath(option.lang, path)}
            hrefLang={option.lang}
            lang={option.lang}
            aria-current={active ? "true" : undefined}
            title={option.name}
            // Se conserva la búsqueda y el ancla (ej. /replays#replay-…) al cambiar de idioma.
            onClick={(e) => {
              if (active) return e.preventDefault();
              e.preventDefault();
              window.location.assign(localePath(option.lang, path) + window.location.search + window.location.hash);
            }}
            className={cn(
              "flex h-full items-center rounded-full px-2.5 text-xs font-bold tracking-wide transition-colors",
              active ? "bg-accent text-white" : "text-muted hover:text-text",
            )}
          >
            {option.label}
          </a>
        );
      })}
    </nav>
  );
}
