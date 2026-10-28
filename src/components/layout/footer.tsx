import { cacheLife } from "next/cache";
import Link from "next/link";
import { getPublicSettings } from "@/lib/settings";
import { Logo } from "./logo";

const LEGAL_LINKS = [
  { href: "/como-participar", label: "Cómo participar" },
  { href: "/juego-responsable", label: "Juego responsable" },
  { href: "/bases-y-condiciones", label: "Bases y condiciones" },
  { href: "/privacidad", label: "Privacidad" },
];

/** El año se calcula dentro del caché: con Cache Components no se puede leer la hora en el prerender. */
async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export async function Footer() {
  const [settings, year] = await Promise.all([getPublicSettings(), currentYear()]);

  return (
    <footer className="mt-auto border-t border-line bg-bg-alt">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <section aria-labelledby="footer-rg" className="max-w-3xl space-y-2">
            <h2 id="footer-rg" className="flex items-center gap-2 font-semibold">
              <span className="rounded border border-gold/60 px-1 text-[10px] font-bold text-gold">+18</span>
              Juego responsable
            </h2>
            <p className="text-sm text-muted">
              Los juegos de azar son entretenimiento, no una forma de ganar plata. Poné un límite antes de empezar y no
              apuestes lo que no podés perder. Si se te va de las manos, pedí ayuda:{" "}
              <span className="text-text">{settings.responsible_gaming_helpline}</span>.
            </p>
            <p className="text-xs text-subtle">
              Los links a casinos de esta web son links de referido: Matías recibe una comisión si te registrás desde
              ellos.
            </p>
          </section>
          <Logo className="shrink-0" />
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} Matías Salvetti ·{" "}
            <span>
              Datos de slots:{" "}
              <a href="https://slot.report" target="_blank" className="hover:text-text">
                slot.report
              </a>
            </span>
          </p>
          <nav aria-label="Legales">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-text">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
