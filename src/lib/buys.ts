import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { CASINO_EMBED, type CasinoRef } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

/** Listados y home. Cada sesión además tiene su propio tag (`buySessionTag`). */
export const BUYS_TAG = "buy-sessions";
export const buySessionTag = (id: string) => `buy-session:${id}`;

type SessionRow = Pick<
  Tables<"buy_sessions">,
  "id" | "title" | "currency" | "status" | "calls_open" | "finished_at" | "created_at"
>;

export type BuySessionSummary = SessionRow & {
  casino: CasinoRef | null;
  buys: Pick<Tables<"buys">, "bet" | "cost" | "payout">[];
};

export type PublicBuy = Pick<
  Tables<"buys">,
  "id" | "position" | "slot_name" | "provider" | "bet" | "cost" | "payout" | "multi" | "opened_at"
>;

export type PublicBuySession = BuySessionSummary & { buyList: PublicBuy[] };

const SESSION_COLUMNS = `id, title, currency, status, calls_open, finished_at, created_at, ${CASINO_EMBED}`;

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

  const { data: buys } = await supabase
    .from("buys")
    .select("id, position, slot_name, provider, bet, cost, payout, multi, opened_at")
    .eq("session_id", id)
    .order("position")
    .order("created_at");
  const buyList = buys ?? [];

  return { ...session, buys: buyList.map(({ bet, cost, payout }) => ({ bet, cost, payout })), buyList };
}
