import { Play, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BRAND_LABELS, type BrandName } from "@/components/ui/brand-icon";
import { buttonClasses } from "@/components/ui/button";
import { BRAND_ASSETS, hasBrandAsset } from "@/lib/brand";
import { formatDateTime, formatInteger } from "@/lib/format";
import type { LiveStatus } from "@/lib/live-status";
import type { PublicSettings } from "@/lib/settings";
import { PartnerLogo } from "@/components/layout/partner-logo";
import { FloatingDecor } from "./floating-decor";
import { HeroDecor } from "./hero-decor";

const PLATFORM_LABEL = { twitch: "Twitch", kick: "Kick" } as const;

/** Redes que se listan como links de texto debajo de los botones (la principal ya tiene su botón). */
const TEXT_SOCIALS: BrandName[] = ["twitch", "kick", "youtube", "instagram", "tiktok", "discord"];

export type HeroExtras = {
  /** Premios totales de la Wager Race en curso o próxima, ya formateados (ej. "1M ARS"). */
  wagerPrize: string | null;
  /** Hunt en curso, para la tarjeta de "en vivo". */
  activeHunt: { title: string; status: string } | null;
};

export function Hero({ settings, live, extras }: { settings: PublicSettings; live: LiveStatus; extras: HeroExtras }) {
  const primary = settings.primary_platform;
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_72%_45%,rgb(157_59_255/0.22),transparent_60%)]"
      />
      <FloatingDecor />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-14 pb-16 md:grid-cols-[1.1fr_1fr] md:pt-20 md:pb-24">
        <div>
          <h1
            id="hero-title"
            className="animate-rise font-display text-7xl leading-[0.95] tracking-wide uppercase sm:text-8xl lg:text-9xl"
          >
            <span className="text-glow">Chupetti</span>
          </h1>
          <p className="mt-3 flex animate-rise items-center font-display text-3xl tracking-wide uppercase [animation-delay:120ms]">
            <PartnerLogo />
          </p>
          <p className="mt-6 max-w-lg animate-rise text-lg text-muted [animation-delay:240ms]">
            Slots, bonus hunts, batallas y CS2 en vivo. Todos los meses reparto premios con la Wager Race y los sorteos
            de la comunidad.
          </p>

          <div className="mt-8 flex animate-rise flex-wrap gap-3 [animation-delay:360ms]">
            <a
              href={settings.socials[primary]}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ size: "lg" })}
            >
              <Play className="size-5" aria-hidden />
              Ver el stream en {PLATFORM_LABEL[primary]}
            </a>
            <Link href="/wager-race" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              <Trophy className="size-5 text-gold" aria-hidden />
              Wager Race{extras.wagerPrize ? ` · ${extras.wagerPrize}` : ""}
            </Link>
          </div>

          <ul
            className="mt-6 flex animate-rise flex-wrap gap-x-5 gap-y-2 text-sm [animation-delay:480ms]"
            aria-label="Redes de Chupetti"
          >
            {TEXT_SOCIALS.filter((name) => name !== primary).map((name) => (
              <li key={name}>
                <a
                  href={settings.socials[name]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted transition-colors hover:text-accent-light"
                >
                  {BRAND_LABELS[name]}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <Character live={live} settings={settings} activeHunt={extras.activeHunt} />
      </div>
    </section>
  );
}

function Character({
  live,
  settings,
  activeHunt,
}: {
  live: LiveStatus;
  settings: PublicSettings;
  activeHunt: HeroExtras["activeHunt"];
}) {
  const personaje = BRAND_ASSETS.personaje;

  return (
    <div className="relative mx-auto w-full max-w-[26rem]">
      {/* Aura radial */}
      <div
        aria-hidden
        className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgb(157_59_255/0.5),rgb(157_59_255/0.12)_45%,transparent_70%)] blur-2xl"
      />
      <HeroDecor />
      {/* Aro punteado que gira muy lento */}
      <div
        aria-hidden
        className="absolute inset-x-[4%] top-[8%] aspect-square animate-spin-slow rounded-full border-2 border-dashed border-accent/40"
      />

      {/* Cada animación en su propio elemento: float mueve, glow respira. */}
      <div className="relative animate-float">
        {hasBrandAsset("personaje") ? (
          <Image
            src={personaje.src}
            alt="Ilustración de Chupetti con bata violeta de bordes neón y fichas de casino en la mano"
            width={personaje.width}
            height={personaje.height}
            priority
            sizes="(min-width: 768px) 26rem, 90vw"
            className="animate-glow"
          />
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center rounded-3xl border border-dashed border-line-strong text-sm text-subtle">
            [personaje.png]
          </div>
        )}
      </div>

      <LiveCard live={live} settings={settings} activeHunt={activeHunt} />
    </div>
  );
}

function LiveCard({
  live,
  settings,
  activeHunt,
}: {
  live: LiveStatus;
  settings: PublicSettings;
  activeHunt: HeroExtras["activeHunt"];
}) {
  const href = settings.socials[live.platform ?? settings.primary_platform];

  if (live.live && live.platform) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-6 -left-2 max-w-[17rem] animate-float rounded-2xl border border-live/50 bg-bg/90 p-3 pr-4 shadow-[0_0_30px_-8px_rgb(255_77_109/0.6)] backdrop-blur [animation-delay:-3s] sm:-left-8"
      >
        <span className="flex items-center gap-2 text-xs font-bold tracking-wide text-live uppercase">
          <span aria-hidden className="size-2 animate-live-pulse rounded-full bg-live" />
          En vivo en {BRAND_LABELS[live.platform]}
        </span>
        {activeHunt ? (
          <span className="mt-1 line-clamp-2 block text-sm font-semibold">
            {activeHunt.title} · {activeHunt.status.toLowerCase()}
          </span>
        ) : live.title ? (
          <span className="mt-1 line-clamp-2 block text-sm font-semibold">{live.title}</span>
        ) : null}
        {live.viewers !== null ? (
          <span className="num mt-1 block text-xs text-muted">{formatInteger(live.viewers)} viendo</span>
        ) : null}
      </a>
    );
  }

  const nextAt = settings.next_stream.at;
  const when = settings.next_stream.label || (nextAt ? formatDateTime(nextAt) : "[día y hora]");
  return (
    <div className="absolute bottom-6 -left-2 animate-float rounded-2xl border border-line-strong bg-bg/90 px-4 py-3 backdrop-blur [animation-delay:-3s] sm:-left-8">
      <span className="block text-xs font-bold tracking-wide text-subtle uppercase">Offline</span>
      <span className="mt-0.5 block text-sm">
        Próximo stream <span className="num text-accent-light">{when}</span>
      </span>
    </div>
  );
}
