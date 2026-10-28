import Link from "next/link";
import { cn } from "@/lib/cn";

export function CatalogTabs({ active, isAdmin }: { active: "slots" | "casinos"; isAdmin: boolean }) {
  const tabs = [
    { key: "slots", href: "/panel/catalogo", label: "Slots" },
    ...(isAdmin ? [{ key: "casinos", href: "/panel/catalogo/casinos", label: "Casinos" }] : []),
  ];
  return (
    <nav aria-label="Catálogo" className="flex gap-1 border-b border-line">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-4 py-2 text-sm font-semibold",
            active === tab.key ? "border-accent text-accent-light" : "border-transparent text-muted hover:text-text",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
