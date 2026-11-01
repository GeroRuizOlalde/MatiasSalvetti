import { cacheLife } from "next/cache";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { Logo } from "./logo";

const LEGAL_LINKS = [
  { href: "/como-participar", label: "howTo" },
  { href: "/bases-y-condiciones", label: "terms" },
  { href: "/privacidad", label: "privacy" },
] as const;

/** El año se calcula dentro del caché: con Cache Components no se puede leer la hora en el prerender. */
async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export async function Footer({ lang }: { lang: Locale }) {
  const year = await currentYear();
  const { t, href } = getI18n(lang);

  return (
    <footer className="mt-auto border-t border-line bg-bg-alt">
      {/* pb-28: el cohete de «volver arriba» no tapa los links del final. */}
      <div className="mx-auto max-w-7xl px-4 pt-10 pb-28">
        <div className="flex flex-col gap-3 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-3">
            <Logo className="shrink-0" lang={lang} />
            <span>
              © {year} Chupetti ·{" "}
              <span>
                {t.layout.slotData}{" "}
                <a href="https://slot.report" target="_blank" className="hover:text-text">
                  slot.report
                </a>
              </span>
            </span>
          </p>
          <nav aria-label={t.layout.legalNav}>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={href(link.href)} className="hover:text-text">
                    {t.nav[link.label]}
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
