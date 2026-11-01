import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { getCurrentProfile, isPanelRole } from "@/lib/auth/session";
import { LoginButton } from "./login-button";
import { UserMenuDropdown } from "./user-menu-dropdown";

/** Lee la sesión: va siempre dentro de un <Suspense>. */
export async function UserMenu({ lang }: { lang: Locale }) {
  const profile = await getCurrentProfile();
  if (!profile) return <LoginButton lang={lang} />;
  return (
    <UserMenuDropdown
      displayName={profile.display_name || profile.twitch_login || getI18n(lang).t.userMenu.user}
      avatarUrl={profile.avatar_url}
      canUsePanel={isPanelRole(profile.role) && !profile.banned_at}
      level={profile.level}
      points={profile.points}
    />
  );
}

export function UserMenuFallback() {
  return <div aria-hidden className="h-10 w-36 animate-pulse rounded-full bg-surface-2" />;
}
