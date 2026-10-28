import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

export const CASINOS_TAG = "casinos";

export type PublicCasino = Pick<Tables<"casinos">, "id" | "name" | "slug" | "logo_path" | "referral_url" | "code">;

export async function getActiveCasinos(): Promise<PublicCasino[]> {
  "use cache";
  cacheTag(CASINOS_TAG);
  cacheLife("hours");

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("casinos")
    .select("id, name, slug, logo_path, referral_url, code")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  return data ?? [];
}
