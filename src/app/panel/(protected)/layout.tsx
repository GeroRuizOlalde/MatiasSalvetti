import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { PanelSidebar, SIDEBAR_COOKIE } from "@/components/panel/panel-nav";
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
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  const name = profile.display_name || profile.twitch_login || "Usuario";

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <PanelSidebar
        isAdmin={profile.role === "admin"}
        initialCollapsed={collapsed}
        user={{ name, role: profile.role === "admin" ? "Admin" : "Moderador", avatarUrl: profile.avatar_url }}
        signOut={signOut}
      />
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
