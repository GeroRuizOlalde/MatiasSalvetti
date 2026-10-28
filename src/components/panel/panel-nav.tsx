"use client";

import {
  BadgeCheck,
  Coins,
  Crosshair,
  ExternalLink,
  Gift,
  House,
  Layers,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingCart,
  Sparkles,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  { title: "General", items: [{ href: "/panel", label: "Inicio", icon: House }] },
  {
    title: "En vivo",
    items: [
      { href: "/panel/hunts", label: "Bonus Hunt", icon: Crosshair },
      { href: "/panel/buys", label: "Bonus Buys", icon: ShoppingCart },
      { href: "/panel/battles", label: "Bonus Battle", icon: Swords },
      { href: "/panel/tipeos", label: "Tipeos", icon: Sparkles },
    ],
  },
  {
    title: "Comunidad",
    items: [
      { href: "/panel/wager-race", label: "Wager Race", icon: Trophy, adminOnly: true },
      { href: "/panel/verificaciones", label: "Verificaciones", icon: BadgeCheck, adminOnly: true },
      { href: "/panel/sorteos", label: "Sorteos", icon: Gift, adminOnly: true },
      { href: "/panel/puntos", label: "Puntos y misiones", icon: Coins, adminOnly: true },
    ],
  },
  {
    title: "Ajustes",
    items: [
      { href: "/panel/catalogo", label: "Catálogo", icon: Layers },
      { href: "/panel/configuracion", label: "Configuración", icon: Settings, adminOnly: true },
      { href: "/panel/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
    ],
  },
];

export const SIDEBAR_COOKIE = "panel_sidebar";

/**
 * Barra lateral del panel. En desktop se puede achicar a solo íconos; la
 * preferencia queda en una cookie para que el server la pinte igual al volver.
 */
export function PanelSidebar({
  isAdmin,
  initialCollapsed,
  user,
  signOut,
}: {
  isAdmin: boolean;
  initialCollapsed: boolean;
  user: { name: string; role: string; avatarUrl: string | null };
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isAdmin || !item.adminOnly),
  })).filter((group) => group.items.length);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/panel; max-age=31536000; samesite=lax`;
  };

  // Achicada solo aplica en desktop; en mobile la barra va arriba y horizontal.
  const hideWhenCollapsed = collapsed ? "lg:hidden" : "";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={cn(
        "flex flex-col border-b border-line bg-bg-alt px-3 py-3 lg:sticky lg:top-0 lg:h-dvh lg:shrink-0 lg:border-r lg:border-b-0 lg:py-5",
        "transition-[width] duration-200",
        collapsed ? "lg:w-[4.25rem]" : "lg:w-60",
      )}
    >
      <div className={cn("mb-3 flex items-center gap-2 px-2 lg:mb-6", collapsed ? "lg:justify-center lg:px-0" : "")}>
        <Link
          href="/panel"
          className={cn("font-display text-2xl tracking-wide text-accent-light uppercase", hideWhenCollapsed)}
        >
          Panel MS
        </Link>
        <Link
          href="/"
          className={cn("ml-auto flex items-center gap-1 text-xs text-subtle hover:text-text", hideWhenCollapsed)}
        >
          Ver web <ExternalLink className="size-3" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Mostrar barra lateral" : "Esconder barra lateral"}
          title={collapsed ? "Mostrar barra" : "Esconder barra"}
          className="hidden rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-text lg:block"
        >
          <ToggleIcon className="size-4" aria-hidden />
        </button>
      </div>

      <nav
        aria-label="Panel"
        className="flex gap-1 overflow-x-auto pb-1 lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-4 lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0"
      >
        {groups.map((group) => (
          <div key={group.title} className="contents lg:block">
            <p
              className={cn(
                "mb-1 hidden px-3 text-[11px] font-semibold tracking-wider text-subtle uppercase lg:block",
                collapsed ? "lg:hidden" : "",
              )}
            >
              {group.title}
            </p>
            {collapsed ? <hr className="mx-2 mb-2 hidden border-line lg:block" aria-hidden /> : null}
            <ul className="contents lg:flex lg:flex-col lg:gap-1">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/panel" ? pathname === href : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold",
                        collapsed ? "lg:justify-center lg:px-0" : "",
                        active ? "bg-surface-2 text-accent-light" : "text-muted hover:bg-surface-2 hover:text-text",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className={cn("whitespace-nowrap", collapsed ? "lg:sr-only" : "")}>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "mt-4 hidden items-center gap-2 border-t border-line px-2 pt-4 lg:flex",
          collapsed ? "lg:flex-col lg:px-0" : "",
        )}
      >
        <span title={collapsed ? `${user.name} · ${user.role}` : undefined}>
          <Avatar url={user.avatarUrl} name={user.name} size={28} />
        </span>
        <div className={cn("min-w-0 flex-1", collapsed ? "lg:hidden" : "")}>
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-subtle">{user.role}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            title="Salir"
            className="flex items-center gap-1 rounded-md p-1.5 text-xs text-subtle hover:bg-surface-2 hover:text-text"
          >
            <LogOut className="size-4" aria-hidden />
            <span className={collapsed ? "sr-only" : ""}>Salir</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
