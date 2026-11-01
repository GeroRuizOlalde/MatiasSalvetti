import { getI18n, pageLocale } from "@/i18n/server";
import { ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import { BuySessionCard } from "@/components/buys/buy-session-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getPublicBuySessions } from "@/lib/buys";

export async function generateMetadata({ params }: PageProps<"/[lang]/bonus-buys">): Promise<Metadata> {
  const { t } = getI18n(await pageLocale(params));
  return { title: "Bonus Buy", description: t.buys.metaDescription };
}

export default async function BonusBuysPage({ params }: PageProps<"/[lang]/bonus-buys">) {
  const lang = await pageLocale(params);
  const { t } = getI18n(lang);
  const sessions = await getPublicBuySessions();
  const live = sessions.filter((s) => s.status === "live");
  const past = sessions.filter((s) => s.status !== "live");

  return (
    <>
      <PageHeader kicker={t.buys.kicker} title="Bonus Buy">
        {t.buys.intro}
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-12 px-4 pb-16">
        {sessions.length === 0 ? (
          <EmptyState icon={ShoppingCart} title={t.buys.emptyTitle}>
            {t.buys.empty}
          </EmptyState>
        ) : null}
        {[
          { key: "live", title: t.buys.live, list: live },
          { key: "past", title: t.buys.past, list: past },
        ].map(({ key, title, list }) =>
          list.length ? (
            <section key={key} aria-labelledby={`${key}-title`}>
              <h2 id={`${key}-title`} className="mb-4 font-display text-3xl tracking-wide uppercase">
                {title}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((session) => (
                  <li key={session.id} className="reveal">
                    <BuySessionCard session={session} lang={lang} />
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
