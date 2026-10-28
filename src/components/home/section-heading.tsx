import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function SectionHeading({
  id,
  kicker,
  title,
  link,
  children,
}: {
  id: string;
  kicker?: string;
  title: string;
  link?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {kicker ? <p className="font-marker text-lg text-accent-text">{kicker}</p> : null}
        <h2 id={id} className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
          {title}
        </h2>
        {children ? <div className="mt-2 max-w-2xl text-muted">{children}</div> : null}
      </div>
      {link ? (
        <Link href={link.href} className="flex items-center gap-1 text-sm font-semibold text-accent-text hover:text-accent-light">
          {link.label} <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
