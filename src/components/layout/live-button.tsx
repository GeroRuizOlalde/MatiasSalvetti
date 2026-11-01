import { CalendarClock } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { BRAND_LABELS } from "@/components/ui/brand-icon";
import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { formatDateTime, formatInteger } from "@/lib/format";
import { getLiveStatus } from "@/lib/live-status";
import { getPublicSettings } from "@/lib/settings";

/** "EN VIVO" con link al canal activo (Twitch primero) o el próximo stream si está offline. */
export async function LiveButton({ compact = false, lang }: { compact?: boolean; lang: Locale }) {
  const [status, settings] = await Promise.all([getLiveStatus(), getPublicSettings()]);
  const { t } = getI18n(lang);

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

  const nextAt = settings.next_stream.at;
  const when = settings.next_stream.label || (nextAt ? formatDateTime(nextAt, lang) : t.live.dayAndTime);
  return (
    <a
      href={settings.socials[settings.primary_platform]}
      target="_blank"
      rel="noopener noreferrer"
      title={t.live.nextStreamAt(when)}
      className={buttonClasses({ variant: "secondary", size: "sm", className: compact ? "w-full" : undefined })}
    >
      <CalendarClock className="size-4 text-accent-text" aria-hidden />
      <span>
        {t.live.nextStream}{" "}
        {/* En el header la fecha entra recién en pantallas anchas; en el menú del celular, siempre. */}
        <span className={compact ? "num text-accent-light" : "num hidden text-accent-light 2xl:inline"}>{when}</span>
      </span>
    </a>
  );
}
