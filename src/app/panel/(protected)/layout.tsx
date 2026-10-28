import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { PanelNav } from "@/components/panel/panel-nav";
import { Avatar } from "@/components/ui/avatar";
import { requirePanelProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <PanelShell>{children}</PanelShell>
    </Suspense>
  );
}

async function PanelShell({ children }: { children: ReactNode }) {
  const profile = await requirePanelProfile("mod");
  const name = profile.display_name || profile.twitch_login || "Usuario";

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="border-b border-line bg-bg-alt px-3 py-3 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:py-5">
        <div className="mb-3 flex items-center justify-between gap-2 px-2 lg:mb-6">
          <Link href="/panel" className="font-display text-2xl tracking-wide text-accent-light uppercase">
            Panel MS
          </Link>
          <Link href="/" className="flex items-center gap-1 text-xs text-subtle hover:text-text">
            Ver web <ExternalLink className="size-3" aria-hidden />
          </Link>
        </div>
        <PanelNav isAdmin={profile.role === "admin"} />
        <div className="mt-4 hidden items-center gap-2 border-t border-line px-2 pt-4 lg:flex">
          <Avatar url={profile.avatar_url} name={name} size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-xs text-subtle">{profile.role === "admin" ? "Admin" : "Moderador"}</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="text-xs text-subtle hover:text-text">
              Salir
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true">
      <div className="hidden w-60 border-r border-line bg-bg-alt lg:block" />
      <div className="flex-1 p-8">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}
