import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { CASINO_EMBED, type CasinoRef } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

/** Listados y home. Cada sesión además tiene su propio tag (`buySessionTag`). */
export const BUYS_TAG = "buy-sessions";
export const buySessionTag = (id: string) => `buy-session:${id}`;

type SessionRow = Pick<Tables<"buy_sessions">, "id" | "title" | "currency" | "status" | "finished_at" | "created_at">;

export type BuySessionSummary = SessionRow & {
  casino: CasinoRef | null;
  buys: Pick<Tables<"buys">, "bet" | "cost" | "payout">[];
};

export type PublicBuy = Pick<
  Tables<"buys">,
  "id" | "position" | "slot_name" | "provider" | "bet" | "cost" | "payout" | "multi" | "opened_at"
>;

export type PublicPollOption = { id: string; position: number; slotName: string; votes: number };

export type PublicPoll = {
  id: string;
  isOpen: boolean;
  createdAt: string;
  closedAt: string | null;
  winnerOptionId: string | null;
  options: PublicPollOption[];
  totalVotes: number;
};

export type PublicBuySession = BuySessionSummary & { buyList: PublicBuy[]; polls: PublicPoll[] };

const SESSION_COLUMNS = `id, title, currency, status, finished_at, created_at, ${CASINO_EMBED}`;

/** Sesiones públicas: las en vivo primero, después las terminadas más recientes. */
export async function getPublicBuySessions(limit = 24): Promise<BuySessionSummary[]> {
  "use cache";
  cacheTag(BUYS_TAG);
  cacheLife("hunt");

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("buy_sessions")
    .select(`${SESSION_COLUMNS}, buys(bet, cost, payout)`)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).sort((a, b) => Number(b.status === "live") - Number(a.status === "live"));
}

export async function getPublicBuySession(id: string): Promise<PublicBuySession | null> {
  "use cache";
  cacheTag(BUYS_TAG, buySessionTag(id));
  cacheLife("hunt");

  const supabase = createPublicClient();
  if (!supabase || !z.uuid().safeParse(id).success) return null;

  const { data: session } = await supabase.from("buy_sessions").select(SESSION_COLUMNS).eq("id", id).maybeSingle();
  if (!session) return null;

  const [{ data: buys }, { data: polls }, { data: counts }] = await Promise.all([
    supabase
      .from("buys")
      .select("id, position, slot_name, provider, bet, cost, payout, multi, opened_at")
      .eq("session_id", id)
      .order("position")
      .order("created_at"),
    supabase
      .from("buy_polls")
      .select(
        "id, is_open, created_at, closed_at, winner_option_id, options:buy_poll_options!buy_poll_options_poll_id_fkey(id, position, slot_name)",
      )
      .eq("session_id", id)
      .order("created_at", { ascending: false }),
    supabase.rpc("buy_poll_counts", { p_session: id }),
  ]);

  const votes = new Map((counts ?? []).map((c) => [c.option_id, c.votes]));
  const buyList = buys ?? [];

  return {
    ...session,
    buys: buyList.map(({ bet, cost, payout }) => ({ bet, cost, payout })),
    buyList,
    polls: (polls ?? []).map((poll) => {
      const options = [...poll.options]
        .sort((a, b) => a.position - b.position)
        .map((o) => ({ id: o.id, position: o.position, slotName: o.slot_name, votes: votes.get(o.id) ?? 0 }));
      return {
        id: poll.id,
        isOpen: poll.is_open,
        createdAt: poll.created_at,
        closedAt: poll.closed_at,
        winnerOptionId: poll.winner_option_id,
        options,
        totalVotes: options.reduce((sum, o) => sum + o.votes, 0),
      };
    }),
  };
}
