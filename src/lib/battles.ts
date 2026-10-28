import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import type { BracketMatch } from "@/lib/calc/bracket";
import { CASINO_EMBED, getProfileNames, type CasinoRef, type PublicProfileName } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

/** Listados y home. Cada battle además tiene su propio tag (`battleTag`). */
export const BATTLES_TAG = "battles";
export const battleTag = (id: string) => `battle:${id}`;

type BattleRow = Pick<
  Tables<"battles">,
  "id" | "title" | "currency" | "status" | "winner_entry_id" | "started_at" | "finished_at" | "created_at"
>;

export type BattleEntry = Pick<Tables<"battle_entries">, "id" | "seed" | "slot_name" | "provider">;

export type BattleSummary = BattleRow & { casino: CasinoRef | null; entries: BattleEntry[] };

export type PublicBattle = BattleSummary & {
  matches: BracketMatch[];
  /** Picks por entry_id. */
  picks: Record<string, number>;
  totalPicks: number;
  /** Quiénes bancaron al campeón (solo cuando terminó). */
  championBackers: PublicProfileName[];
};

const BATTLE_COLUMNS = `id, title, currency, status, winner_entry_id, started_at, finished_at, created_at, ${CASINO_EMBED}, entries:battle_entries!battle_entries_battle_id_fkey(id, seed, slot_name, provider)`;

const ACTIVE = new Set(["open", "live"]);

function sortEntries<T extends { entries: BattleEntry[] }>(battle: T): T {
  return { ...battle, entries: [...battle.entries].sort((a, b) => a.seed - b.seed) };
}

/** Battles públicas: las en curso primero, después las terminadas más recientes. */
export async function getPublicBattles(limit = 24): Promise<BattleSummary[]> {
  "use cache";
  cacheTag(BATTLES_TAG);
  cacheLife("hunt");

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("battles")
    .select(BATTLE_COLUMNS)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(sortEntries).sort((a, b) => Number(ACTIVE.has(b.status)) - Number(ACTIVE.has(a.status)));
}

export async function getPublicBattle(id: string): Promise<PublicBattle | null> {
  "use cache";
  cacheTag(BATTLES_TAG, battleTag(id));
  cacheLife("hunt");

  const supabase = createPublicClient();
  if (!supabase || !z.uuid().safeParse(id).success) return null;

  const { data: battle } = await supabase.from("battles").select(BATTLE_COLUMNS).eq("id", id).maybeSingle();
  if (!battle) return null;

  const [{ data: matches }, { data: counts }, { data: backers }] = await Promise.all([
    supabase
      .from("battle_matches")
      .select("id, round, slot, entry_a, entry_b, bet_a, payout_a, bet_b, payout_b, winner_entry_id")
      .eq("battle_id", id),
    supabase.rpc("battle_pick_counts", { p_battle: id }),
    battle.status === "finished" && battle.winner_entry_id
      ? supabase
          .from("battle_picks")
          .select("user_id")
          .eq("battle_id", id)
          .eq("entry_id", battle.winner_entry_id)
          .order("created_at")
          .limit(50)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);

  const names = await getProfileNames((backers ?? []).map((b) => b.user_id));
  const picks = Object.fromEntries((counts ?? []).map((c) => [c.entry_id, c.picks]));

  return {
    ...sortEntries(battle),
    matches: matches ?? [],
    picks,
    totalPicks: Object.values(picks).reduce((sum, n) => sum + n, 0),
    championBackers: (backers ?? []).flatMap((b) => names.get(b.user_id) ?? []),
  };
}
