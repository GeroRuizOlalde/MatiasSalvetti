import {
  BookOpen,
  Castle,
  Crosshair,
  Gift,
  House,
  ShieldCheck,
  ShoppingCart,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { title: string | null; items: NavItem[] };

/** Menú lateral de la web, agrupado como en Stake. */
export const NAV_GROUPS: NavGroup[] = [
  { title: null, items: [{ href: "/", label: "Inicio", icon: House }] },
  {
    title: "En vivo",
    items: [
      { href: "/bonus-hunt", label: "Bonus Hunt", icon: Crosshair },
      { href: "/bonus-buys", label: "Bonus Buy", icon: ShoppingCart },
      { href: "/bonus-battle", label: "Bonus Battle", icon: Swords },
    ],
  },
  {
    title: "Comunidad",
    items: [
      { href: "/wager-race", label: "Wager Race", icon: Trophy },
      { href: "/sorteos", label: "Sorteos", icon: Gift },
      { href: "/cuartel", label: "Cuartel", icon: Castle },
    ],
  },
  {
    title: "Info",
    items: [
      { href: "/como-participar", label: "Cómo participar", icon: BookOpen },
      { href: "/juego-responsable", label: "Juego responsable", icon: ShieldCheck },
    ],
  },
];

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
