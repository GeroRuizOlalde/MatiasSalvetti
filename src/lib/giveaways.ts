import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getProfileNames, type PublicProfileName } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

export const GIVEAWAYS_TAG = "giveaways";

export type PublicGiveaway = Pick<
  Tables<"giveaways">,
  | "id"
  | "title"
  | "prize"
  | "description"
  | "image_path"
  | "starts_at"
  | "ends_at"
  | "entry_mode"
  | "max_tickets_per_user"
  | "winners_count"
  | "min_level"
  | "drawn_at"
> & {
  casino: { id: string; name: string; referral_url: string } | null;
  /** Calculado al cachear; puede atrasar un poco. */
  phase: "upcoming" | "open" | "closed";
  participants: number;
  entries: number;
  winners: (PublicProfileName & { position: number })[];
};

/** Sorteos publicados: los abiertos primero, después los próximos y los cerrados. */
export async function getPublicGiveaways(): Promise<PublicGiveaway[]> {
  "use cache";
  cacheTag(GIVEAWAYS_TAG);
  cacheLife("hunt");

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("giveaways")
    .select(
      "id, title, prize, description, image_path, starts_at, ends_at, entry_mode, max_tickets_per_user, winners_count, min_level, drawn_at, casino:casinos(id, name, referral_url), winners:giveaway_winners(user_id, position, status)",
    )
    .eq("status", "published")
    .order("ends_at", { ascending: false })
    .limit(40);
  const giveaways = data ?? [];

  const [stats, names] = await Promise.all([
    Promise.all(giveaways.map((g) => supabase.rpc("giveaway_stats", { p_giveaway: g.id }))),
    getProfileNames(giveaways.flatMap((g) => g.winners.map((w) => w.user_id))),
  ]);

  const now = Date.now();
  const order = { open: 0, upcoming: 1, closed: 2 } as const;
  return giveaways
    .map(({ winners, ...g }, i) => {
      const phase: PublicGiveaway["phase"] =
        now < new Date(g.starts_at).getTime() ? "upcoming" : now < new Date(g.ends_at).getTime() ? "open" : "closed";
      return {
        ...g,
        phase,
        participants: stats[i].data?.[0]?.participants ?? 0,
        entries: stats[i].data?.[0]?.entries ?? 0,
        winners: winners
          .filter((w) => w.status !== "void")
          .sort((a, b) => a.position - b.position)
          .flatMap((w) => {
            const user = names.get(w.user_id);
            return user ? [{ ...user, position: w.position }] : [];
          }),
      };
    })
    .sort((a, b) => order[a.phase] - order[b.phase]);
}
