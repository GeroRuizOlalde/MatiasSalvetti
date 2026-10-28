import { CalendarClock } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { BRAND_LABELS } from "@/components/ui/brand-icon";
import { formatDateTime, formatInteger } from "@/lib/format";
import { getLiveStatus } from "@/lib/live-status";
import { getPublicSettings } from "@/lib/settings";

/** "EN VIVO" con link al canal activo (Twitch primero) o el próximo stream si está offline. */
export async function LiveButton({ compact = false }: { compact?: boolean }) {
  const [status, settings] = await Promise.all([getLiveStatus(), getPublicSettings()]);

  if (status.live && status.platform) {
    const label = `En vivo ahora en ${BRAND_LABELS[status.platform]}${
      status.viewers !== null ? `, ${formatInteger(status.viewers)} viendo` : ""
    }`;
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
        EN VIVO
        {compact ? <span className="font-normal">en {BRAND_LABELS[status.platform]}</span> : null}
      </a>
    );
  }

  const nextAt = settings.next_stream.at;
  const when = settings.next_stream.label || (nextAt ? formatDateTime(nextAt) : "[día y hora]");
  return (
    <a
      href={settings.socials[settings.primary_platform]}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClasses({ variant: "secondary", size: "sm", className: compact ? "w-full" : undefined })}
    >
      <CalendarClock className="size-4 text-accent-text" aria-hidden />
      <span>
        Próximo stream <span className="num text-accent-light">{when}</span>
      </span>
    </a>
  );
}
