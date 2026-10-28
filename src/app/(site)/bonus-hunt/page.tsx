import { Crosshair } from "lucide-react";
import type { Metadata } from "next";
import { HuntCard } from "@/components/hunts/hunt-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { isHuntActive } from "@/lib/hunt-status";
import { getPublicHunts } from "@/lib/hunts";

export const metadata: Metadata = {
  title: "Bonus Hunt",
  description: "Seguí cada hunt en vivo: bonos, balance, calls y adiviná el balance.",
};

export default async function BonusHuntPage() {
  const hunts = await getPublicHunts();
  const active = hunts.filter((h) => isHuntActive(h.status));
  const past = hunts.filter((h) => !isHuntActive(h.status));

  return (
    <>
      <PageHeader kicker="juntamos y abrimos" title="Bonus Hunt">
        Juntamos bonos, los abrimos en vivo y vos adivinás con cuánto termina. Pedí tu slot mientras el hunt esté
        abierto a calls.
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-12 px-4 pb-16">
        {hunts.length === 0 ? (
          <EmptyState icon={Crosshair} title="Todavía no hay hunts">
            El primero aparece acá apenas arranque en el stream.
          </EmptyState>
        ) : null}

        {active.length ? (
          <section aria-labelledby="active-title">
            <h2 id="active-title" className="mb-4 font-display text-3xl tracking-wide uppercase">
              En curso
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((hunt) => (
                <li key={hunt.id}>
                  <HuntCard hunt={hunt} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {past.length ? (
          <section aria-labelledby="past-title">
            <h2 id="past-title" className="mb-4 font-display text-3xl tracking-wide uppercase">
              Anteriores
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((hunt) => (
                <li key={hunt.id}>
                  <HuntCard hunt={hunt} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
