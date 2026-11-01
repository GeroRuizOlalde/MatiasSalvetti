import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { LanguageSwitch } from "./language-switch";
import { LiveButton } from "./live-button";
import { Logo } from "./logo";
import { Notifications } from "@/components/notifications/notifications";
import { PartnerLogo } from "./partner-logo";
import { SidebarToggle } from "./sidebar-toggle";
import { UserMenu, UserMenuFallback } from "./user-menu";

export function TopBar({ lang }: { lang: Locale }) {
  const { t } = getI18n(lang);
  return (
    <div className="border-b border-line bg-bg-alt">
      <p className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-xs text-muted">
        <span className="rounded border border-gold/60 px-1 text-[10px] font-bold text-gold">+18</span>
        <span>{t.layout.adultNotice}</span>
      </p>
    </div>
  );
}

export function Header({ lang }: { lang: Locale }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <SidebarToggle />
        <div className="flex shrink-0 items-center gap-2">
          <Logo lang={lang} />
          <PartnerLogo className="hidden text-xl sm:inline-flex" />
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="hidden md:block">
            <LiveButton lang={lang} />
          </div>
          {/* En celular va en el menú lateral, para que el header no se pase de ancho. */}
          <div className="hidden md:block">
            <LanguageSwitch />
          </div>
          <Suspense fallback={null}>
            <Notifications scope="site" />
          </Suspense>
          <Suspense fallback={<UserMenuFallback />}>
            <UserMenu lang={lang} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
