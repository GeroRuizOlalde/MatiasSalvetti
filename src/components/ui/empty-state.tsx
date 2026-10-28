import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center",
        className,
      )}
    >
      <Icon className="size-10 text-accent-text" aria-hidden />
      <h2 className="font-display text-2xl tracking-wide uppercase">{title}</h2>
      {children ? <div className="max-w-md text-sm text-muted">{children}</div> : null}
    </div>
  );
}
