import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Suspense } from "react";
import { LiveButton } from "./live-button";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { MobileMenuFallback } from "./mobile-menu-fallback";
import { NavLinkList, NavLinks } from "./nav-links";
import { UserMenu, UserMenuFallback } from "./user-menu";

export function TopBar() {
  return (
    <div className="border-b border-line bg-bg-alt">
      <p className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-xs text-muted">
        <ShieldAlert className="size-3.5 text-gold" aria-hidden />
        <span>
          <strong className="text-text">+18</strong> · Jugá con responsabilidad ·{" "}
          <Link href="/juego-responsable" className="text-accent-text underline-offset-2 hover:underline">
            Más info
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
        <Logo className="shrink-0" />
        {/* usePathname() en rutas dinámicas (ej. /bonus-hunt/[id]) necesita un Suspense para prerenderizar. */}
        <Suspense fallback={<NavLinkList className="hidden lg:block" pathname={null} />}>
          <NavLinks className="hidden lg:block" />
        </Suspense>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">
            <LiveButton />
          </div>
          <div className="hidden lg:block">
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
