"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isActivePath, NAV_LINKS } from "./nav";

export function NavLinks({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className={className}>
      <ul className={cn("flex", orientation === "vertical" ? "flex-col gap-1" : "items-center gap-1")}>
        {NAV_LINKS.map(({ href, label }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-semibold transition-colors",
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
