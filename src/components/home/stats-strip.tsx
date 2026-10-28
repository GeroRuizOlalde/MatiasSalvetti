export type Stat = { label: string; value: string };

/** Franja de números. Las stats sin dato no se muestran; sin ninguna, no se muestra la franja. */
export function StatsStrip({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <section aria-label="Números del canal" className="border-y border-line bg-bg-alt">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1 py-6 text-center">
            <dt className="order-2 text-xs font-semibold tracking-wide text-subtle uppercase">{stat.label}</dt>
            <dd className="num order-1 text-2xl font-bold text-gold sm:text-3xl">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
