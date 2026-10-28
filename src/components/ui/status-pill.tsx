import { cn } from "@/lib/cn";
import type { StatusTone } from "@/lib/session-status";

export function StatusPill({ label, tone, className }: { label: string; tone: StatusTone; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "muted" && "bg-surface-2 text-subtle",
        tone === "live" && "bg-live/15 text-live",
        tone === "done" && "bg-accent/15 text-accent-text",
        tone === "next" && "bg-gold/15 text-gold",
        className,
      )}
    >
      {tone === "live" ? <span aria-hidden className="size-1.5 animate-live-pulse rounded-full bg-live" /> : null}
      {label}
    </span>
  );
}
