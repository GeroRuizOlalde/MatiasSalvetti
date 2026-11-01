import { Gift, Trophy } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { BRAND_LABELS, BrandIcon } from "@/components/ui/brand-icon";
import { CountdownText } from "@/components/wager/countdown-text";
import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { formatInteger } from "@/lib/format";
import { getLiveStatus } from "@/lib/live-status";
import { getOfflineHighlight } from "@/lib/offline-highlight";
import { getPublicSettings } from "@/lib/settings";

/** "EN VIVO" con link al canal activo (Twitch primero); offline, un sorteo, la Wager Race o seguirlo. */
export async function LiveButton({ compact = false, lang }: { compact?: boolean; lang: Locale }) {
  const [status, settings] = await Promise.all([getLiveStatus(), getPublicSettings()]);
  const { t, href } = getI18n(lang);

  if (status.live && status.platform) {
    const label = t.live.liveNow(
      BRAND_LABELS[status.platform],
      status.viewers !== null ? formatInteger(status.viewers) : null,
    );
    return (
      <a
        href={settings.socials[status.platform]}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={status.title ?? undefined}
        className={buttonClasses({ variant: "live", size: "sm", className: compact ? "w-full" : undefined })}
      >
        <span aria-hidden className="size-2 animate-live-pulse rounded-full bg-white" />
        {t.live.live}
        {compact ? <span className="font-normal">{t.live.on(BRAND_LABELS[status.platform])}</span> : null}
      </a>
    );
  }

  // Offline: lo más importante del momento (sorteo abierto, Wager Race o seguirlo en Twitch).
  const highlight = await getOfflineHighlight();
  const className = buttonClasses({ variant: "secondary", size: "sm", className: compact ? "w-full" : undefined });

  if (highlight.kind === "follow") {
    const platform = settings.primary_platform;
    return (
      <a href={settings.socials[platform]} target="_blank" rel="noopener noreferrer" className={className}>
        <BrandIcon name={platform} className="size-4 text-accent-text" />
        {t.live.follow(BRAND_LABELS[platform])}
      </a>
    );
  }

  const giveaway = highlight.kind === "giveaway";
  const Icon = giveaway ? Gift : Trophy;
  return (
    <Link
      href={href(giveaway ? "/sorteos" : "/wager-race")}
      title={giveaway ? t.live.giveawayTitle(highlight.title) : t.live.wagerTitle(highlight.title)}
      className={className}
    >
      <Icon className="size-4 text-gold" aria-hidden />
      <span>
        {giveaway ? t.live.giveaway : t.live.wager}{" "}
        {/* En el header la cuenta regresiva entra en pantallas anchas; en el menú del celular, siempre. */}
        <span className={compact ? "num text-accent-light" : "num hidden text-accent-light xl:inline"}>
          · {giveaway ? t.live.closesIn : t.live.endsIn} <CountdownText target={highlight.endsAt} />
        </span>
      </span>
    </Link>
  );
}
