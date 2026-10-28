import { CopyButton } from "@/components/ui/copy-button";
import { buttonClasses } from "@/components/ui/button";
import { PartnerLogo } from "@/components/layout/partner-logo";
import type { PublicCasino } from "@/lib/casinos";
import type { PublicSettings } from "@/lib/settings";

/** «Chupetti by 1xSlots»: el casino partner, con link, código y beneficios (editable en Configuración). */
export function PartnerSection({ casino, partner }: { casino: PublicCasino; partner: PublicSettings["partner"] }) {
  return (
    <section aria-labelledby="partner-title" className="mx-auto max-w-7xl px-4 pt-16">
      <div className="grid gap-8 rounded-3xl border border-accent/50 bg-[linear-gradient(135deg,rgb(157_59_255/0.16),transparent_55%)] p-6 shadow-[0_0_40px_-12px_rgb(157_59_255/0.6)] sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="num text-xs tracking-[0.2em] text-subtle uppercase">Partner oficial</p>
          <h2
            id="partner-title"
            className="mt-2 flex flex-wrap items-center gap-3 font-display text-5xl tracking-wide uppercase"
          >
            Chupetti <PartnerLogo />
          </h2>
          <p className="mt-4 max-w-xl text-sm text-muted">{partner.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={casino.referral_url}
              target="_blank"
              rel="noopener sponsored"
              className={buttonClasses({ size: "md" })}
            >
              Registrarme en {casino.name}
            </a>
            {casino.code ? (
              <span className="flex items-center gap-1 rounded-lg border border-dashed border-line-strong py-1 pr-1 pl-3 text-sm">
                Código: <span className="num font-bold text-gold">{casino.code}</span>
                <CopyButton value={casino.code} label="Copiar código" />
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-subtle">
            Link de referido: si te registrás, Matías recibe una comisión. +18. Jugá con responsabilidad.
          </p>
        </div>
        {partner.perks.length ? (
          <ul className="space-y-3">
            {partner.perks.map((perk) => (
              <li
                key={perk.label}
                className="flex items-center justify-between gap-4 rounded-xl border border-line bg-bg/60 px-4 py-3 text-sm"
              >
                <span className="font-semibold">{perk.label}</span>
                <span className="num font-bold text-gold">{perk.value}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
