import { ArrowRight, Crosshair, ShoppingCart, Swords, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { SectionHeading } from "./section-heading";

export type SessionCard = {
  key: "hunt" | "buys" | "battle";
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** null = todavía no hay sesiones cargadas. */
  status: { label: string; tone: "live" | "past" | "next" } | null;
  facts: { label: string; value: string }[];
};

// Hasta las fases 3 y 4 no hay sesiones: las tarjetas muestran su estado vacío.
export const EMPTY_SESSIONS: SessionCard[] = [
  {
    key: "hunt",
    title: "Bonus Hunt",
    href: "/bonus-hunt",
    icon: Crosshair,
    description: "Juntamos bonos, los abrimos en vivo y vos adivinás el balance final.",
    status: null,
    facts: [],
  },
  {
    key: "buys",
    title: "Bonus Buys",
    href: "/bonus-buys",
    icon: ShoppingCart,
    description: "Compras de bonus una atrás de otra. Votá cuál sigue.",
    status: null,
    facts: [],
  },
  {
    key: "battle",
    title: "Bonus Battle",
    href: "/bonus-battle",
    icon: Swords,
    description: "Slots cara a cara en eliminación directa. Bancá a tu favorito.",
    status: null,
    facts: [],
  },
];

const TONE: Record<"live" | "past" | "next", string> = {
  live: "bg-live/15 text-live",
  past: "bg-surface-2 text-muted",
  next: "bg-accent/15 text-accent-text",
};

export function Sessions({ cards }: { cards: SessionCard[] }) {
  return (
    <section aria-labelledby="sessions-title" className="mx-auto max-w-7xl px-4 py-16">
      <SectionHeading id="sessions-title" kicker="no te pierdas nada" title="Seguí cada sesión" />
      <ul className="grid gap-4 md:grid-cols-3">
        {cards.map(({ key, title, href, icon: Icon, description, status, facts }) => (
          <li key={key}>
            <Link
              href={href}
              className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-accent/60"
            >
              <div className="flex items-center justify-between gap-3">
                <Icon className="size-7 text-accent-text" aria-hidden />
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", status ? TONE[status.tone] : TONE.past)}>
                  {status?.label ?? "Sin sesiones todavía"}
                </span>
              </div>
              <h3 className="mt-4 font-display text-3xl tracking-wide uppercase">{title}</h3>
              <p className="mt-2 text-sm text-muted">{description}</p>
              {facts.length > 0 ? (
                <dl className="mt-5 grid grid-cols-2 gap-3">
                  {facts.map((fact) => (
                    <div key={fact.label} className="rounded-lg bg-surface-2 px-3 py-2">
                      <dt className="text-xs text-subtle">{fact.label}</dt>
                      <dd className="num font-semibold text-gold">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <span className="mt-auto flex items-center gap-1 pt-6 text-sm font-semibold text-accent-text group-hover:text-accent-light">
                Ver {title} <ArrowRight className="size-4" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
