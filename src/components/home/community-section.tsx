import { ArrowUpRight } from "lucide-react";
import { BrandIcon } from "@/components/ui/brand-icon";
import type { Socials } from "@/lib/settings";
import { SectionHeading } from "./section-heading";

const CHANNELS = [
  {
    key: "discord" as const,
    title: "Discord",
    text: "Charlá con la comunidad, enterate de los sorteos y pasá clips.",
    accent: "hover:border-[#5865F2]/70",
  },
  {
    key: "whatsapp" as const,
    title: "WhatsApp",
    text: "Avisos de stream y novedades directo a tu celular.",
    accent: "hover:border-[#25D366]/70",
  },
];

export function CommunitySection({ socials }: { socials: Socials }) {
  return (
    <section aria-labelledby="community-title" className="border-t border-line bg-bg-alt">
      <div className="mx-auto max-w-7xl px-4 py-16">
        <SectionHeading id="community-title" kicker="sumate" title="Comunidad" />
        <ul className="grid gap-4 md:grid-cols-2">
          {CHANNELS.map(({ key, title, text, accent }) => (
            <li key={key}>
              <a
                href={socials[key]}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center gap-5 rounded-2xl border border-line bg-surface p-6 transition-colors ${accent}`}
              >
                <BrandIcon name={key} className="size-12 shrink-0 text-text" />
                <div className="flex-1">
                  <h3 className="font-display text-3xl tracking-wide uppercase">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </div>
                <ArrowUpRight className="size-6 text-subtle group-hover:text-text" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
