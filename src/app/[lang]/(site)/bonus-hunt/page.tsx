import { Crosshair } from "lucide-react";
import type { Metadata } from "next";
import { HuntCard } from "@/components/hunts/hunt-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { isHuntActive } from "@/lib/hunt-status";
import { getPublicHunts } from "@/lib/hunts";
import { getI18n, pageLocale } from "@/i18n/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/bonus-hunt">): Promise<Metadata> {
  const { t } = getI18n(await pageLocale(params));
  return { title: "Bonus Hunt", description: t.hunt.metaDescription };
}

export default async function BonusHuntPage({ params }: PageProps<"/[lang]/bonus-hunt">) {
  const lang = await pageLocale(params);
  const { t } = getI18n(lang);
  const hunts = await getPublicHunts();
  const active = hunts.filter((h) => isHuntActive(h.status));
  const past = hunts.filter((h) => !isHuntActive(h.status));

  return (
    <>
      <PageHeader kicker={t.hunt.kicker} title="Bonus Hunt">
        {t.hunt.intro}
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-12 px-4 pb-16">
        {hunts.length === 0 ? (
          <EmptyState icon={Crosshair} title={t.hunt.emptyTitle}>
            {t.hunt.empty}
          </EmptyState>
        ) : null}

        {active.length ? (
          <section aria-labelledby="active-title">
            <h2 id="active-title" className="mb-4 font-display text-3xl tracking-wide uppercase">
              {t.hunt.running}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((hunt) => (
                <li key={hunt.id} className="reveal">
                  <HuntCard hunt={hunt} lang={lang} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {past.length ? (
          <section aria-labelledby="past-title">
            <h2 id="past-title" className="mb-4 font-display text-3xl tracking-wide uppercase">
              {t.hunt.past}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((hunt) => (
                <li key={hunt.id} className="reveal">
                  <HuntCard hunt={hunt} lang={lang} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
