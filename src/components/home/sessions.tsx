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
  /** Arriba a la derecha (fecha de la sesión). */
  meta?: string;
  facts: { label: string; value: string }[];
};

// Estado vacío de cada tarjeta. La home las completa con la sesión en curso o la última de cada una.
export const EMPTY_SESSIONS: SessionCard[] = [
  {
    key: "hunt",
    title: "Bonus Hunt",
    href: "/bonus-hunt",
    icon: Crosshair,
    description:
      "Junto bonos durante el stream y los abro todos juntos. Seguí cada slot, el break-even y adiviná el balance final.",
    status: null,
    facts: [],
  },
  {
    key: "buys",
    title: "Bonus Buys",
    href: "/bonus-buys",
    icon: ShoppingCart,
    description: "Sesiones de compra directa de bonos. Cuánto costó cada uno, cuánto pagó y el resultado acumulado.",
    status: null,
    facts: [],
  },
  {
    key: "battle",
    title: "Bonus Battle",
    href: "/bonus-battle",
    icon: Swords,
    description:
      "Slots elegidos por el chat, uno contra otro. El que paga mejor multiplicador pasa de ronda. Elegí tu slot.",
    status: null,
    facts: [],
  },
];

const TONE: Record<"live" | "past" | "next", string> = {
  live: "bg-live/15 text-live",
  past: "bg-surface-2 text-muted",
  next: "bg-accent/20 text-accent-light",
};

export function Sessions({ cards }: { cards: SessionCard[] }) {
  return (
    <section aria-labelledby="sessions-title" className="mx-auto max-w-7xl px-4 py-16">
      <SectionHeading id="sessions-title" kicker="lo que pasa en el stream" title="Seguí cada sesión" />
      <ul className="grid gap-4 md:grid-cols-3">
        {cards.map(({ key, title, href, description, status, meta, facts }) => (
          <li key={key} className="reveal">
            <Link
              href={href}
              className="group lift flex h-full flex-col rounded-2xl border border-line bg-surface p-5 hover:border-accent/60"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                    status ? TONE[status.tone] : TONE.past,
                  )}
                >
                  {status?.label ?? "Sin sesiones todavía"}
                </span>
                {meta ? <span className="num text-xs text-subtle">{meta}</span> : null}
              </div>
              <h3 className="mt-4 font-display text-3xl tracking-wide uppercase">{title}</h3>
              <p className="mt-2 text-sm text-muted">{description}</p>
              {facts.length > 0 ? (
                <dl className="mt-auto flex gap-8 border-t border-line pt-4">
                  {facts.map((fact) => (
                    <div key={fact.label} className="min-w-0">
                      <dt className="num text-[10px] tracking-wide text-subtle uppercase">{fact.label}</dt>
                      <dd className="num truncate font-semibold">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <span className="mt-auto flex items-center gap-1 pt-6 text-sm font-semibold text-accent-text group-hover:text-accent-light">
                  Ver {title} <ArrowRight className="size-4" aria-hidden />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
