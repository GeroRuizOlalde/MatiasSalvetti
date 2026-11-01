import {
  BookOpen,
  Castle,
  Clapperboard,
  Crosshair,
  Gift,
  House,
  ShoppingCart,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import type { Messages } from "@/i18n/messages";

type NavKey = keyof Messages["nav"];
export type NavItem = { href: string; label: NavKey; icon: LucideIcon };
export type NavGroup = { title: NavKey | null; items: NavItem[] };

/** Menú lateral de la web, agrupado como en Stake. */
export const NAV_GROUPS: NavGroup[] = [
  // `label` y `title` son claves de los textos (`nav` en i18n/messages).
  { title: null, items: [{ href: "/", label: "home", icon: House }] },
  {
    title: "live",
    items: [
      { href: "/bonus-hunt", label: "bonusHunt", icon: Crosshair },
      { href: "/bonus-buys", label: "bonusBuy", icon: ShoppingCart },
      { href: "/bonus-battle", label: "bonusBattle", icon: Swords },
    ],
  },
  {
    title: "community",
    items: [
      { href: "/wager-race", label: "wagerRace", icon: Trophy },
      { href: "/sorteos", label: "giveaways", icon: Gift },
      { href: "/replays", label: "replays", icon: Clapperboard },
      { href: "/cuartel", label: "hq", icon: Castle },
    ],
  },
  { title: "info", items: [{ href: "/como-participar", label: "howTo", icon: BookOpen }] },
];

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
