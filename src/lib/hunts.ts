import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { rankGuesses, type Guess } from "@/lib/calc/hunt";
import { isHuntActive } from "@/lib/hunt-status";
import { getProfileNames, type CasinoRef, type PublicProfileName } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

export type { PublicProfileName } from "@/lib/public-data";

/** Listados y home. Cada hunt además tiene su propio tag (`huntTag`). */
export const HUNTS_TAG = "hunts";
export const huntTag = (id: string) => `hunt:${id}`;

type HuntRow = Pick<
  Tables<"hunts">,
  | "id"
  | "title"
  | "currency"
  | "start_cost"
  | "status"
  | "calls_open"
  | "guesses_open"
  | "final_balance"
  | "finished_at"
  | "created_at"
>;

export type HuntSummary = HuntRow & {
  casino: CasinoRef | null;
  bonuses: Pick<Tables<"hunt_bonuses">, "bet" | "payout">[];
};

export type PublicHuntBonus = Pick<
  Tables<"hunt_bonuses">,
  "id" | "position" | "slot_name" | "provider" | "bet" | "payout" | "multi" | "opened_at"
> & { calledBy: PublicProfileName | null };

export type RankedGuess = Guess & { user: PublicProfileName; diff: number };

export type PublicHunt = HuntSummary & {
  bonusList: PublicHuntBonus[];
  guessCount: number;
  winner: PublicProfileName | null;
  /** Solo cuando terminó. */
  guesses: RankedGuess[];
};

const HUNT_COLUMNS =
  "id, title, currency, start_cost, status, calls_open, guesses_open, final_balance, finished_at, created_at, casino:casinos(name, slug, referral_url, code)";

/** Hunts públicos: los activos primero, después los terminados más recientes. */
export async function getPublicHunts(limit = 24): Promise<HuntSummary[]> {
  "use cache";
  cacheTag(HUNTS_TAG);
  cacheLife("hunt");

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("hunts")
    .select(`${HUNT_COLUMNS}, bonuses:hunt_bonuses(bet, payout)`)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).sort((a, b) => Number(isHuntActive(b.status)) - Number(isHuntActive(a.status)));
}

export async function getPublicHunt(id: string): Promise<PublicHunt | null> {
  "use cache";
  cacheTag(HUNTS_TAG, huntTag(id));
  cacheLife("hunt");

  const supabase = createPublicClient();
  if (!supabase || !z.uuid().safeParse(id).success) return null;

  const { data: hunt } = await supabase
    .from("hunts")
    .select(`${HUNT_COLUMNS}, gtb_winner_id`)
    .eq("id", id)
    .maybeSingle();
  if (!hunt) return null;

  const [{ data: bonuses }, { data: guessCount }, { data: guesses }] = await Promise.all([
    supabase
      .from("hunt_bonuses")
      .select("id, position, slot_name, provider, bet, payout, multi, opened_at, called_by")
      .eq("hunt_id", id)
      .order("position")
      .order("created_at"),
    supabase.rpc("hunt_guess_count", { p_hunt: id }),
    hunt.status === "finished"
      ? supabase.from("hunt_guesses").select("user_id, amount, updated_at").eq("hunt_id", id)
      : Promise.resolve({ data: [] as { user_id: string; amount: number; updated_at: string }[] }),
  ]);

  const names = await getProfileNames([
    hunt.gtb_winner_id,
    ...(bonuses ?? []).map((b) => b.called_by),
    ...(guesses ?? []).map((g) => g.user_id),
  ]);

  const { gtb_winner_id, ...rest } = hunt;
  const bonusList = (bonuses ?? []).map(({ called_by, ...b }) => ({
    ...b,
    calledBy: called_by ? (names.get(called_by) ?? null) : null,
  }));
  const named = (guesses ?? []).flatMap((g) => {
    const user = names.get(g.user_id);
    return user ? [{ userId: g.user_id, user, amount: g.amount, updatedAt: g.updated_at }] : [];
  });

  return {
    ...rest,
    bonuses: bonusList.map(({ bet, payout }) => ({ bet, payout })),
    bonusList,
    guessCount: guessCount ?? 0,
    winner: gtb_winner_id ? (names.get(gtb_winner_id) ?? null) : null,
    guesses: hunt.final_balance === null ? [] : rankGuesses(named, hunt.final_balance),
  };
}

/** Para la franja de números de la home. */
export async function getHuntRecords(): Promise<{ hunts: number; bestMulti: number | null }> {
  "use cache";
  cacheTag(HUNTS_TAG);
  cacheLife("hours");

  const supabase = createPublicClient();
  if (!supabase) return { hunts: 0, bestMulti: null };
  const [{ count }, { data: best }] = await Promise.all([
    supabase.from("hunts").select("id", { count: "exact", head: true }).neq("status", "draft"),
    supabase
      .from("hunt_bonuses")
      .select("multi")
      .not("multi", "is", null)
      .order("multi", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return { hunts: count ?? 0, bestMulti: best?.multi ?? null };
}
