import Link from "next/link";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/server";

export async function CatalogTabs({
  active,
  isAdmin,
}: {
  active: "slots" | "suggested" | "casinos";
  isAdmin: boolean;
}) {
  // Cuántos slots sugeridos por los viewers faltan revisar.
  const supabase = await createClient();
  const { count } = await supabase
    .from("slot_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const tabs = [
    { key: "slots", href: "/panel/catalogo", label: "Slots", badge: 0 },
    { key: "suggested", href: "/panel/catalogo/sugeridos", label: "Sugeridos", badge: count ?? 0 },
    ...(isAdmin ? [{ key: "casinos", href: "/panel/catalogo/casinos", label: "Casinos", badge: 0 }] : []),
  ];
  return (
    <nav aria-label="Catálogo" className="flex gap-1 border-b border-line">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold",
            active === tab.key ? "border-accent text-accent-light" : "border-transparent text-muted hover:text-text",
          )}
        >
          {tab.label}
          {tab.badge ? (
            <span className="num rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">{tab.badge}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
