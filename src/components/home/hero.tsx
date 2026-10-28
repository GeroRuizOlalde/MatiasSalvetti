import { Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BRAND_LABELS, BrandIcon, type BrandName } from "@/components/ui/brand-icon";
import { buttonClasses } from "@/components/ui/button";
import { BRAND_ASSETS, hasBrandAsset } from "@/lib/brand";
import { formatDateTime, formatInteger } from "@/lib/format";
import type { LiveStatus } from "@/lib/live-status";
import type { PublicSettings } from "@/lib/settings";
import { FloatingDecor } from "./floating-decor";

const HERO_SOCIALS: BrandName[] = ["twitch", "kick", "youtube", "instagram", "tiktok"];

export function Hero({ settings, live }: { settings: PublicSettings; live: LiveStatus }) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_72%_45%,rgb(157_59_255/0.22),transparent_60%)]"
      />
      <FloatingDecor />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-14 pb-16 md:grid-cols-[1.1fr_1fr] md:pt-20 md:pb-24">
        <div>
          <p className="-rotate-2 font-marker text-2xl text-accent-text">bienvenidos al casino</p>
          <h1
            id="hero-title"
            className="mt-3 font-display text-6xl leading-[0.95] tracking-wide uppercase sm:text-7xl lg:text-8xl"
          >
            Matías <span className="text-glow block">Salvetti</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted">
            Slots, casino online y CS2 en vivo. Seguí cada bonus hunt, sumate a los sorteos y competí en la Wager
            Race con la comunidad.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href={settings.socials.twitch} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size: "lg" })}>
              <BrandIcon name="twitch" className="size-5" />
              Ver el stream en Twitch
            </a>
            <Link href="/wager-race" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              <Trophy className="size-5 text-gold" aria-hidden />
              Wager Race
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Redes de Matías">
            {HERO_SOCIALS.map((name) => (
              <li key={name}>
                <a
                  href={settings.socials[name]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={BRAND_LABELS[name]}
                  className="flex size-11 items-center justify-center rounded-full border border-line bg-surface/80 text-muted transition-colors hover:border-accent hover:text-accent-light"
                >
                  <BrandIcon name={name} className="size-[18px]" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <Character live={live} settings={settings} />
      </div>
    </section>
  );
}

function Character({ live, settings }: { live: LiveStatus; settings: PublicSettings }) {
  const personaje = BRAND_ASSETS.personaje;

  return (
    <div className="relative mx-auto w-full max-w-[26rem]">
      {/* Aura radial */}
      <div
        aria-hidden
        className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgb(157_59_255/0.5),rgb(157_59_255/0.12)_45%,transparent_70%)] blur-2xl"
      />
      {/* Aro punteado que gira muy lento */}
      <div aria-hidden className="absolute inset-x-[4%] top-[8%] aspect-square animate-spin-slow rounded-full border-2 border-dashed border-accent/40" />

      {/* Cada animación en su propio elemento: float mueve, glow respira. */}
      <div className="relative animate-float">
        {hasBrandAsset("personaje") ? (
          <Image
            src={personaje.src}
            alt="Ilustración de Matías Salvetti con bata violeta de bordes neón y fichas de casino en la mano"
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

      <LiveCard live={live} settings={settings} />
    </div>
  );
}

function LiveCard({ live, settings }: { live: LiveStatus; settings: PublicSettings }) {
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
        {live.title ? <span className="mt-1 line-clamp-2 block text-sm font-semibold">{live.title}</span> : null}
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
