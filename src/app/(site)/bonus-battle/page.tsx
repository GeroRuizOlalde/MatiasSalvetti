import { Swords } from "lucide-react";
import type { Metadata } from "next";
import { BattleCard } from "@/components/battles/battle-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getPublicBattles } from "@/lib/battles";

export const metadata: Metadata = {
  title: "Bonus Battle",
  description: "Slots cara a cara en eliminación directa. Calleá el tuyo y pasá de ronda.",
};

export default async function BonusBattlePage() {
  const battles = await getPublicBattles();
  const active = battles.filter((b) => b.status === "open" || b.status === "live");
  const past = battles.filter((b) => b.status === "finished");

  return (
    <>
      <PageHeader kicker="cara a cara" title="Bonus Battle">
        Slots en eliminación directa: cada viewer callea su slot y en cada cruce pasa el que pagó más. El último que
        queda es el campeón.
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-12 px-4 pb-16">
        {battles.length === 0 ? (
          <EmptyState icon={Swords} title="Todavía no hay battles">
            La primera aparece acá apenas se arme en el stream.
          </EmptyState>
        ) : null}
        {[
          { key: "active", title: "En curso", list: active },
          { key: "past", title: "Anteriores", list: past },
        ].map(({ key, title, list }) =>
          list.length ? (
            <section key={key} aria-labelledby={`${key}-title`}>
              <h2 id={`${key}-title`} className="mb-4 font-display text-3xl tracking-wide uppercase">
                {title}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((battle) => (
                  <li key={battle.id} className="reveal">
                    <BattleCard battle={battle} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
      </div>
    </>
  );
}
