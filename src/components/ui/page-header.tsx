import type { ReactNode } from "react";

export function PageHeader({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mx-auto max-w-7xl px-4 pt-12 pb-8 sm:pt-16">
      {kicker ? <p className="font-marker text-lg text-accent-text">{kicker}</p> : null}
      <h1 className="mt-1 font-display text-5xl tracking-wide uppercase sm:text-6xl">{title}</h1>
      {children ? <div className="mt-4 max-w-2xl text-muted">{children}</div> : null}
    </header>
  );
}
