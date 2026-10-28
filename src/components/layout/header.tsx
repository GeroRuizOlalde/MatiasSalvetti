import Link from "next/link";
import { Suspense } from "react";
import { LiveButton } from "./live-button";
import { Logo } from "./logo";
import { Notifications } from "@/components/notifications/notifications";
import { PartnerLogo } from "./partner-logo";
import { SidebarToggle } from "./sidebar-toggle";
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
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <SidebarToggle />
        <div className="flex shrink-0 items-center gap-2">
          <Logo />
          <PartnerLogo className="hidden text-xl sm:inline-flex" />
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="hidden md:block">
            <LiveButton />
          </div>
          <Suspense fallback={null}>
            <Notifications scope="site" />
          </Suspense>
          <Suspense fallback={<UserMenuFallback />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
