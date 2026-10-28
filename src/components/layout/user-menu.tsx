import { getCurrentProfile, isPanelRole } from "@/lib/auth/session";
import { LoginButton } from "./login-button";
import { UserMenuDropdown } from "./user-menu-dropdown";

/** Lee la sesión: va siempre dentro de un <Suspense>. */
export async function UserMenu() {
  const profile = await getCurrentProfile();
  if (!profile) return <LoginButton />;
  return (
    <UserMenuDropdown
      displayName={profile.display_name || profile.twitch_login || "Usuario"}
      avatarUrl={profile.avatar_url}
      canUsePanel={isPanelRole(profile.role) && !profile.banned_at}
    />
  );
}

export function UserMenuFallback() {
  return <div aria-hidden className="h-10 w-36 animate-pulse rounded-full bg-surface-2" />;
}
