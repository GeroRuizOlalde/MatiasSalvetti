export const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/wager-race", label: "Wager Race" },
  { href: "/bonus-hunt", label: "Bonus Hunt" },
  { href: "/bonus-buys", label: "Bonus Buys" },
  { href: "/bonus-battle", label: "Bonus Battle" },
  { href: "/sorteos", label: "Sorteos" },
  { href: "/cuartel", label: "Cuartel" },
] as const;

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
