import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getProfileNames, type PublicProfileName } from "@/lib/public-data";
import { matchProvider, type ReplayProvider } from "@/lib/replay-providers";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

export const REPLAYS_TAG = "replays";

export type PublicReplay = Pick<Tables<"replays">, "id" | "url" | "slot_name" | "multi" | "note" | "created_at"> & {
  provider: ReplayProvider | null;
  user: PublicProfileName | null;
};

/** Proveedores cargados en el panel. */
export async function getReplayProviders(): Promise<ReplayProvider[]> {
  "use cache";
  cacheTag(REPLAYS_TAG);
  cacheLife("hunt");

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase.from("replay_providers").select("id, name, domain, embeddable").order("name");
  return data ?? [];
}

/** Replays aprobados, los más nuevos primero. */
export async function getPublicReplays(limit = 120): Promise<PublicReplay[]> {
  "use cache";
  cacheTag(REPLAYS_TAG);
  cacheLife("hunt");

  const supabase = createPublicClient();
  if (!supabase) return [];
  const [{ data }, providers] = await Promise.all([
    supabase
      .from("replays")
      .select("id, url, host, user_id, slot_name, multi, note, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(limit),
    getReplayProviders(),
  ]);
  const replays = data ?? [];
  const names = await getProfileNames(replays.map((r) => r.user_id));
  return replays.map(({ host, user_id, ...r }) => ({
    ...r,
    provider: matchProvider(host, providers),
    user: names.get(user_id) ?? null,
  }));
}
