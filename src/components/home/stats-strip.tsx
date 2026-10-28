import { cn } from "@/lib/cn";

export type Stat = { label: string; value: string; highlight?: boolean };

/** Franja de números. Las stats sin dato no se muestran; sin ninguna, no se muestra la franja. */
export function StatsStrip({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <section aria-label="Números del canal" className="border-y border-line bg-bg-alt">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 px-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 py-6">
            <dt className="order-2 text-xs text-subtle">{stat.label}</dt>
            <dd
              className={cn("num order-1 text-2xl font-bold sm:text-3xl", stat.highlight ? "text-gold" : "text-text")}
            >
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
