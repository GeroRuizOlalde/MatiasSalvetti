import { getI18n, pageLocale } from "@/i18n/server";
import { Swords } from "lucide-react";
import type { Metadata } from "next";
import { BattleCard } from "@/components/battles/battle-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getPublicBattles } from "@/lib/battles";

export async function generateMetadata({ params }: PageProps<"/[lang]/bonus-battle">): Promise<Metadata> {
  const { t } = getI18n(await pageLocale(params));
  return { title: "Bonus Battle", description: t.battles.metaDescription };
}

export default async function BonusBattlePage({ params }: PageProps<"/[lang]/bonus-battle">) {
  const lang = await pageLocale(params);
  const { t } = getI18n(lang);
  const battles = await getPublicBattles();
  const active = battles.filter((b) => b.status === "open" || b.status === "live");
  const past = battles.filter((b) => b.status === "finished");

  return (
    <>
      <PageHeader kicker={t.battles.kicker} title="Bonus Battle">
        {t.battles.intro}
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-12 px-4 pb-16">
        {battles.length === 0 ? (
          <EmptyState icon={Swords} title={t.battles.emptyTitle}>
            {t.battles.empty}
          </EmptyState>
        ) : null}
        {[
          { key: "active", title: t.battles.running, list: active },
          { key: "past", title: t.battles.past, list: past },
        ].map(({ key, title, list }) =>
          list.length ? (
            <section key={key} aria-labelledby={`${key}-title`}>
              <h2 id={`${key}-title`} className="mb-4 font-display text-3xl tracking-wide uppercase">
                {title}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((battle) => (
                  <li key={battle.id} className="reveal">
                    <BattleCard battle={battle} lang={lang} />
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
