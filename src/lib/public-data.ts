import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

// Piezas compartidas por las páginas públicas de hunts, buys y battles.

export type PublicProfileName = { id: string; name: string; avatarUrl: string | null };

export type CasinoRef = Pick<Tables<"casinos">, "name" | "slug" | "referral_url" | "code">;

export const CASINO_EMBED = "casino:casinos(name, slug, referral_url, code)";

/** Nombre y avatar públicos de cada usuario (vía `public_profiles`). */
export async function getProfileNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const names = new Map<string, PublicProfileName>();
  const supabase = createPublicClient();
  if (!supabase || unique.length === 0) return names;
  const { data } = await supabase
    .from("public_profiles")
    .select("id, display_name, twitch_login, avatar_url")
    .in("id", unique);
  for (const p of data ?? []) {
    if (!p.id) continue;
    names.set(p.id, { id: p.id, name: p.display_name || p.twitch_login || "Viewer", avatarUrl: p.avatar_url });
  }
  return names;
}
