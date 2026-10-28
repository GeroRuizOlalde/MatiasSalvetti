import { cn } from "@/lib/cn";
import { HUNT_STATUS_LABEL, type HuntStatus } from "@/lib/hunt-status";

export function HuntStatusBadge({ status, className }: { status: HuntStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "draft" && "bg-surface-2 text-subtle",
        (status === "collecting" || status === "opening") && "bg-live/15 text-live",
        status === "finished" && "bg-accent/15 text-accent-text",
        className,
      )}
    >
      {status === "opening" ? <span aria-hidden className="size-1.5 animate-live-pulse rounded-full bg-live" /> : null}
      {HUNT_STATUS_LABEL[status]}
    </span>
  );
}
