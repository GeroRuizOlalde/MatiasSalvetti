"use client";

import {
  BadgeCheck,
  Coins,
  Crosshair,
  Gift,
  House,
  Layers,
  Settings,
  ShoppingCart,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean; phase?: number };

// `phase` marca las pantallas que todavía no existen.
const ITEMS: Item[] = [
  { href: "/panel", label: "Inicio", icon: House },
  { href: "/panel/hunts", label: "Bonus Hunt", icon: Crosshair },
  { href: "/panel/buys", label: "Bonus Buys", icon: ShoppingCart, phase: 4 },
  { href: "/panel/battles", label: "Bonus Battle", icon: Swords, phase: 4 },
  { href: "/panel/wager-race", label: "Wager Race", icon: Trophy, adminOnly: true, phase: 5 },
  { href: "/panel/verificaciones", label: "Verificaciones", icon: BadgeCheck, adminOnly: true, phase: 5 },
  { href: "/panel/sorteos", label: "Sorteos", icon: Gift, adminOnly: true, phase: 6 },
  { href: "/panel/puntos", label: "Puntos y misiones", icon: Coins, adminOnly: true, phase: 6 },
  { href: "/panel/catalogo", label: "Catálogo", icon: Layers },
  { href: "/panel/configuracion", label: "Configuración", icon: Settings, adminOnly: true },
  { href: "/panel/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
];

export function PanelNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => isAdmin || !item.adminOnly);

  return (
    <nav aria-label="Panel">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map(({ href, label, icon: Icon, phase }) => {
          const active = href === "/panel" ? pathname === href : pathname.startsWith(href);
          const content = (
            <>
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{label}</span>
              {phase ? (
                <span className="ml-auto rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-subtle">fase {phase}</span>
              ) : null}
            </>
          );
          const classes = "flex items-center gap-2 rounded-md px-3 py-2 text-sm";
          return (
            <li key={href}>
              {phase ? (
                <span aria-disabled="true" className={cn(classes, "cursor-not-allowed text-subtle/70")}>
                  {content}
                </span>
              ) : (
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    classes,
                    "font-semibold",
                    active ? "bg-surface-2 text-accent-light" : "text-muted hover:bg-surface-2 hover:text-text",
                  )}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
