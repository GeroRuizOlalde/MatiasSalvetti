import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

/** Misiones, tienda y ranking de XP. El panel lo invalida en cada cambio. */
export const CUARTEL_TAG = "cuartel";

export type PublicMission = Pick<
  Tables<"missions">,
  "id" | "title" | "description" | "type" | "points" | "xp" | "url" | "starts_at" | "ends_at"
>;

export type ShopItem = Pick<
  Tables<"shop_items">,
  "id" | "title" | "description" | "image_path" | "kind" | "tickets" | "cost" | "stock" | "per_user_limit" | "min_level"
>;

export type XpLeader = { id: string; name: string; avatarUrl: string | null; level: number; xp: number };

export async function getMissions(): Promise<PublicMission[]> {
  "use cache";
  cacheTag(CUARTEL_TAG);
  cacheLife("minutes");

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("missions")
    .select("id, title, description, type, points, xp, url, starts_at, ends_at")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");
  return data ?? [];
}

export async function getShopItems(): Promise<ShopItem[]> {
  "use cache";
  cacheTag(CUARTEL_TAG);
  cacheLife("minutes");

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("shop_items")
    .select("id, title, description, image_path, kind, tickets, cost, stock, per_user_limit, min_level")
    .eq("is_active", true)
    .order("sort_order")
    .order("cost");
  return data ?? [];
}

export async function getXpLeaders(limit = 10): Promise<XpLeader[]> {
  "use cache";
  cacheTag(CUARTEL_TAG);
  cacheLife("minutes");

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("public_profiles")
    .select("id, display_name, twitch_login, avatar_url, level, xp")
    .gt("xp", 0)
    .order("xp", { ascending: false })
    .limit(limit);
  return (data ?? []).flatMap((p) =>
    p.id
      ? [
          {
            id: p.id,
            name: p.display_name || p.twitch_login || "Viewer",
            avatarUrl: p.avatar_url,
            level: p.level ?? 1,
            xp: p.xp ?? 0,
          },
        ]
      : [],
  );
}
