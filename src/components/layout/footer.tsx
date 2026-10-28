import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { BRAND_LABELS, BrandIcon, type BrandName } from "@/components/ui/brand-icon";
import { getPublicSettings } from "@/lib/settings";
import { Logo } from "./logo";

const LEGAL_LINKS = [
  { href: "/como-participar", label: "Cómo participar" },
  { href: "/juego-responsable", label: "Juego responsable" },
  { href: "/bases-y-condiciones", label: "Bases y condiciones" },
  { href: "/privacidad", label: "Privacidad" },
];

const SOCIAL_ORDER: BrandName[] = ["twitch", "kick", "youtube", "instagram", "tiktok", "discord", "whatsapp"];

export async function Footer() {
  const settings = await getPublicSettings();

  return (
    <footer className="mt-auto border-t border-line bg-bg-alt">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <section
          aria-labelledby="footer-rg"
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-start sm:gap-5"
        >
          <ShieldAlert className="size-8 shrink-0 text-gold" aria-hidden />
          <div className="space-y-2 text-sm text-muted">
            <h2 id="footer-rg" className="font-display text-lg tracking-wide text-text uppercase">
              Jugá con responsabilidad · +18
            </h2>
            <p>
              El juego es entretenimiento, no una forma de ganar plata. Poné límites de tiempo y de dinero, y no juegues
              para recuperar lo que perdiste. Si necesitás ayuda, comunicate con{" "}
              <span className="text-text">{settings.responsible_gaming_helpline}</span>.
            </p>
            <p className="text-xs text-subtle">
              Los links a casinos de esta web son links de referido: Matías recibe una comisión si te registrás desde
              ellos.
            </p>
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Logo />
            <div className="text-sm text-subtle">
              <p>Matías Salvetti · Chupetti</p>
              <p className="text-xs">
                Datos de slots:{" "}
                <a href="https://slot.report" target="_blank" className="hover:text-text">
                  slot.report
                </a>
              </p>
            </div>
          </div>
          <nav aria-label="Legales">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-muted hover:text-text">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <ul className="mt-8 flex flex-wrap gap-2" aria-label="Redes">
          {SOCIAL_ORDER.map((name) => (
            <li key={name}>
              <a
                href={settings.socials[name]}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={BRAND_LABELS[name]}
                className="flex size-11 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-accent hover:text-accent-light"
              >
                <BrandIcon name={name} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
