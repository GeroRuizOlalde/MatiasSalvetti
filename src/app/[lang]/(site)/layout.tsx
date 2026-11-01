import { Suspense } from "react";
import { AgeGate } from "@/components/layout/age-gate";
import { BackToTop } from "@/components/layout/back-to-top";
import { Footer } from "@/components/layout/footer";
import { Header, TopBar } from "@/components/layout/header";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { LiveButton } from "@/components/layout/live-button";
import { SidebarNav, SiteSidebar } from "@/components/layout/sidebar";
import { isLocale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export default async function SiteLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang: param } = await params;
  const lang = isLocale(param) ? param : "es";
  const { t } = getI18n(lang);
  // En celular el cajón del menú también muestra el estado del stream y el idioma.
  const drawerExtra = (
    <div className="space-y-3">
      <LiveButton compact lang={lang} />
      <LanguageSwitch />
    </div>
  );

  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-accent px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t.layout.skipToContent}
      </a>
      <TopBar lang={lang} />
      <Header lang={lang} />
      <div className="flex flex-1">
        {/* usePathname() en rutas dinámicas (ej. /bonus-hunt/[id]) necesita un Suspense para prerenderizar. */}
        <Suspense fallback={<SidebarNav pathname={null}>{drawerExtra}</SidebarNav>}>
          <SiteSidebar>{drawerExtra}</SiteSidebar>
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="contenido" className="flex-1">
            {children}
          </main>
          <Footer lang={lang} />
        </div>
      </div>
      <BackToTop />
      <AgeGate />
    </>
  );
}
