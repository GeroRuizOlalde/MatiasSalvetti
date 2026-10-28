"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { isActivePath, NAV_GROUPS } from "./nav";

/*
 * El estado del menú vive en atributos de <html> para no depender de React:
 * - data-sidebar="collapsed": en compu queda solo con íconos (se recuerda en localStorage
 *   y un script en el <head> lo aplica antes de pintar, sin parpadeo).
 * - data-drawer="open": en celular el menú se abre como cajón.
 */
export const SIDEBAR_KEY = "ms-sidebar";

export function closeDrawer() {
  delete document.documentElement.dataset.drawer;
}

export function SiteSidebar({ children }: { children?: ReactNode }) {
  return <SidebarNav pathname={usePathname()}>{children}</SidebarNav>;
}

/** Sin `pathname` no marca ninguno: sirve de fallback mientras se resuelve la URL. */
export function SidebarNav({ pathname, children }: { pathname: string | null; children?: ReactNode }) {
  // Cerrar el cajón al navegar o con Escape.
  useEffect(() => closeDrawer(), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div
        aria-hidden
        onClick={closeDrawer}
        className="fixed inset-0 z-40 hidden bg-black/60 backdrop-blur-sm drawer-open:block lg:drawer-open:hidden"
      />
      <aside
        id="menu-lateral"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 -translate-x-full flex-col border-r border-line bg-bg-alt transition-transform duration-200 drawer-open:translate-x-0",
          "lg:sticky lg:top-16 lg:z-30 lg:h-[calc(100dvh-4rem)] lg:w-60 lg:translate-x-0 lg:transition-[width] lg:collapsed:w-[4.5rem]",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4 lg:hidden">
          <span className="font-display text-2xl tracking-wide text-accent-light uppercase">Menú</span>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Cerrar menú"
            className="flex size-10 items-center justify-center rounded-lg text-text hover:bg-surface-2"
          >
            <X className="size-6" aria-hidden />
          </button>
        </div>
        <nav aria-label="Principal" className="flex-1 space-y-3 overflow-x-hidden overflow-y-auto p-3">
          {children ? <div className="lg:hidden">{children}</div> : null}
          {NAV_GROUPS.map((group, i) => (
            <div key={group.title ?? i} className="rounded-xl bg-surface/70 p-1.5">
              {group.title ? (
                <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider text-subtle uppercase lg:collapsed:hidden">
                  {group.title}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname !== null && isActivePath(pathname, href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        title={label}
                        aria-current={active ? "page" : undefined}
                        onClick={closeDrawer}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors lg:collapsed:justify-center lg:collapsed:px-0",
                          active ? "bg-accent/15 text-accent-light" : "text-muted hover:bg-surface-2 hover:text-text",
                        )}
                      >
                        <Icon className="size-[18px] shrink-0" aria-hidden />
                        <span className="whitespace-nowrap lg:collapsed:sr-only">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
