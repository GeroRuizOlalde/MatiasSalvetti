import { Trophy } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { SectionHeading } from "./section-heading";

// Fase 2: sin eventos cargados. En la fase 5 se suma la cuenta regresiva y el top 3.
export function WagerTeaser() {
  return (
    <section aria-labelledby="wager-title" className="border-y border-line bg-bg-alt">
      <div className="mx-auto max-w-7xl px-4 py-16">
        <SectionHeading id="wager-title" kicker="competí con la comunidad" title="Wager Race" />
        <div className="flex flex-col items-start gap-6 rounded-2xl border border-gold/30 bg-[linear-gradient(135deg,rgb(255_201_77/0.08),transparent_60%)] p-6 sm:flex-row sm:items-center sm:p-8">
          <Trophy className="size-12 shrink-0 text-gold" aria-hidden />
          <div className="flex-1">
            <h3 className="font-display text-2xl tracking-wide uppercase">La próxima carrera se anuncia pronto</h3>
            <p className="mt-1 text-sm text-muted">
              Jugá en los casinos de la comunidad, verificá tu cuenta y sumá wager para quedar en el podio.
            </p>
          </div>
          <Link href="/wager-race" className={buttonClasses({ variant: "secondary" })}>
            Ver detalles
          </Link>
        </div>
      </div>
    </section>
  );
}
