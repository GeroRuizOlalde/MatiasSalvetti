import { Info, Landmark } from "lucide-react";
import { CasinoCard } from "@/components/casinos/casino-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { PublicCasino } from "@/lib/casinos";
import { SectionHeading } from "./section-heading";

export function CasinosSection({ casinos }: { casinos: PublicCasino[] }) {
  return (
    <section aria-labelledby="casinos-title" className="mx-auto max-w-7xl px-4 py-16">
      <SectionHeading id="casinos-title" kicker="donde juega matías" title="Casinos">
        Registrate con el link y el código para participar de la Wager Race y los sorteos exclusivos.
      </SectionHeading>

      {casinos.length === 0 ? (
        <EmptyState icon={Landmark} title="Sin casinos cargados">
          Los casinos de la comunidad aparecen acá apenas se carguen desde el panel.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {casinos.map((casino) => (
            <li key={casino.id}>
              <CasinoCard casino={casino} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs text-subtle">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        Son links de referido: Matías recibe una comisión si te registrás desde acá. Solo para mayores de 18. Jugá con
        responsabilidad.
      </p>
    </section>
  );
}
