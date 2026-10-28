import Link from "next/link";
import { Suspense } from "react";
import { LiveButton } from "./live-button";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { MobileMenuFallback } from "./mobile-menu-fallback";
import { PartnerLogo } from "./partner-logo";
import { NavLinkList, NavLinks } from "./nav-links";
import { UserMenu, UserMenuFallback } from "./user-menu";

export function TopBar() {
  return (
    <div className="border-b border-line bg-bg-alt">
      <p className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-xs text-muted">
        <span className="rounded border border-gold/60 px-1 text-[10px] font-bold text-gold">+18</span>
        <span>
          Contenido para mayores de edad. Jugá con responsabilidad.{" "}
          <Link href="/juego-responsable" className="text-text underline underline-offset-2 hover:text-accent-light">
            ¿Necesitás ayuda?
          </Link>
        </span>
      </p>
    </div>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <div className="flex shrink-0 items-center gap-2">
          <Logo />
          <PartnerLogo className="hidden text-xl sm:inline-flex" />
        </div>
        {/* usePathname() en rutas dinámicas (ej. /bonus-hunt/[id]) necesita un Suspense para prerenderizar. */}
        <Suspense fallback={<NavLinkList className="hidden xl:block" pathname={null} />}>
          <NavLinks className="hidden xl:block" />
        </Suspense>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">
            <LiveButton />
          </div>
          <div className="hidden xl:block">
            <Suspense fallback={<UserMenuFallback />}>
              <UserMenu />
            </Suspense>
          </div>
          <Suspense fallback={<MobileMenuFallback />}>
            <MobileMenu>
              <LiveButton compact />
              <Suspense fallback={<UserMenuFallback />}>
                <UserMenu />
              </Suspense>
            </MobileMenu>
          </Suspense>
        </div>
      </div>
    </header>
  );
}
