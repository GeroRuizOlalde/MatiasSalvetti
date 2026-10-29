import { ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import { BuySessionCard } from "@/components/buys/buy-session-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getPublicBuySessions } from "@/lib/buys";

export const metadata: Metadata = {
  title: "Bonus Buy",
  description: "Todas las compras de bonus, sesión por sesión. Pedí cuál sigue.",
};

export default async function BonusBuysPage() {
  const sessions = await getPublicBuySessions();
  const live = sessions.filter((s) => s.status === "live");
  const past = sessions.filter((s) => s.status !== "live");

  return (
    <>
      <PageHeader kicker="una atrás de otra" title="Bonus Buy">
        Compras de bonus en vivo, con lo que costó y lo que pagó cada una. Mientras la sesión esté en vivo, pedí qué
        slot compramos.
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-12 px-4 pb-16">
        {sessions.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Todavía no hay sesiones">
            La primera aparece acá apenas arranque en el stream.
          </EmptyState>
        ) : null}
        {[
          { key: "live", title: "En vivo", list: live },
          { key: "past", title: "Anteriores", list: past },
        ].map(({ key, title, list }) =>
          list.length ? (
            <section key={key} aria-labelledby={`${key}-title`}>
              <h2 id={`${key}-title`} className="mb-4 font-display text-3xl tracking-wide uppercase">
                {title}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((session) => (
                  <li key={session.id} className="reveal">
                    <BuySessionCard session={session} />
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
