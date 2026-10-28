import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "live";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-[#8a2cec] shadow-[0_0_24px_-6px_rgb(157_59_255/0.7)]",
  secondary: "border border-line-strong bg-surface-2 text-text hover:border-accent-text hover:text-accent-light",
  ghost: "text-muted hover:bg-surface-2 hover:text-text",
  live: "bg-live text-white hover:bg-[#ff3359]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

/** Clases de botón para usar en <button>, <a> o <Link>. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}
