import { ArrowRight, Crosshair, ShoppingCart, Swords, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
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
export function emptySessions(lang: Locale): SessionCard[] {
  const { t, href } = getI18n(lang);
  return [
    {
      key: "hunt",
      title: "Bonus Hunt",
      href: href("/bonus-hunt"),
      icon: Crosshair,
      description: t.home.sessions.huntDescription,
      status: null,
      facts: [],
    },
    {
      key: "buys",
      title: "Bonus Buy",
      href: href("/bonus-buys"),
      icon: ShoppingCart,
      description: t.home.sessions.buysDescription,
      status: null,
      facts: [],
    },
    {
      key: "battle",
      title: "Bonus Battle",
      href: href("/bonus-battle"),
      icon: Swords,
      description: t.home.sessions.battleDescription,
      status: null,
      facts: [],
    },
  ];
}

const TONE: Record<"live" | "past" | "next", string> = {
  live: "bg-live/15 text-live",
  past: "bg-surface-2 text-muted",
  next: "bg-accent/20 text-accent-light",
};

export function Sessions({ cards, lang }: { cards: SessionCard[]; lang: Locale }) {
  const { t } = getI18n(lang);
  return (
    <section aria-labelledby="sessions-title" className="mx-auto max-w-7xl px-4 py-16">
      <SectionHeading id="sessions-title" kicker={t.home.sessions.kicker} title={t.home.sessions.title} />
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
                  {status?.label ?? t.home.sessions.empty}
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
                  {t.home.sessions.see(title)} <ArrowRight className="size-4" aria-hidden />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
