import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getProfileNames, type PublicProfileName } from "@/lib/public-data";
import { matchProvider, type ReplayProvider } from "@/lib/replay-providers";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

export const REPLAYS_TAG = "replays";

export type PublicReplay = Pick<
  Tables<"replays">,
  | "id"
  | "url"
  | "slot_name"
  | "multi"
  | "note"
  | "created_at"
  | "currency"
  | "bet"
  | "bonus_cost"
  | "payout"
  | "likes_count"
  | "comments_count"
  | "edited_at"
  | "slot_id"
> & { provider: ReplayProvider | null; user: PublicProfileName | null };

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
      .select(
        "id, url, host, user_id, slot_name, multi, note, created_at, currency, bet, bonus_cost, payout, likes_count, comments_count, edited_at, slot_id",
      )
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

export type ReplayComment = {
  id: string;
  body: string;
  created_at: string;
  userId: string;
  user: PublicProfileName | null;
};

/** Comentarios de un replay publicado, del más viejo al más nuevo. Sin caché: se piden al abrirlos. */
export async function getReplayComments(replayId: string): Promise<ReplayComment[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("replay_comments")
    .select("id, body, created_at, user_id")
    .eq("replay_id", replayId)
    .order("created_at")
    .limit(200);
  const comments = data ?? [];
  const names = await getProfileNames(comments.map((c) => c.user_id));
  return comments.map((c) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    userId: c.user_id,
    user: names.get(c.user_id) ?? null,
  }));
}
