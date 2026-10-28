import { BrandIcon } from "@/components/ui/brand-icon";
import { buttonClasses } from "@/components/ui/button";
import type { Socials } from "@/lib/settings";

export function CommunitySection({ socials }: { socials: Socials }) {
  return (
    <section aria-labelledby="community-title" className="mx-auto max-w-7xl px-4 py-16">
      <div className="reveal flex flex-col gap-6 rounded-3xl border border-accent/50 p-6 shadow-[0_0_40px_-12px_rgb(157_59_255/0.6)] sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="community-title" className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
            Sumate a la comunidad
          </h2>
          <p className="mt-2 text-sm text-muted">
            En Discord y WhatsApp aviso primero los sorteos, los códigos nuevos y cuándo arranca el stream.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={socials.discord} target="_blank" rel="noopener noreferrer" className={buttonClasses()}>
            <BrandIcon name="discord" className="size-5" />
            Entrar al Discord
          </a>
          <a
            href={socials.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "secondary" })}
          >
            <BrandIcon name="whatsapp" className="size-5" />
            Grupo de WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
