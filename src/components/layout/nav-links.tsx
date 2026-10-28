"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isActivePath, NAV_LINKS } from "./nav";

type Props = { className?: string; orientation?: "horizontal" | "vertical" };

export function NavLinks(props: Props) {
  return <NavLinkList {...props} pathname={usePathname()} />;
}

/** Sin `pathname` no marca ninguno como activo: sirve de fallback mientras se resuelve la URL. */
export function NavLinkList({ className, orientation = "horizontal", pathname }: Props & { pathname: string | null }) {
  return (
    <nav aria-label="Principal" className={className}>
      <ul className={cn("flex", orientation === "vertical" ? "flex-col gap-1" : "items-center gap-1")}>
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname !== null && isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-2.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                  orientation === "vertical" && "py-3 text-base",
                  active ? "text-accent-light" : "text-muted hover:text-text",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
