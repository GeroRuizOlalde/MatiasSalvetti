import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { CASINO_EMBED, type CasinoRef } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database, Tables } from "@/types/database";

export const WAGER_TAG = "wager-races";

export type WagerPhase = "upcoming" | "running" | "ended";

type RaceRow = Pick<
  Tables<"wager_races">,
  "id" | "title" | "currency" | "starts_at" | "ends_at" | "prizes" | "rules_md" | "wager_updated_at"
> & { casino: CasinoRef | null };

/** `phase` se calcula al cachear (puede atrasar ~1 minuto); la cuenta regresiva usa la hora real. */
export type PublicRace = RaceRow & { phase: WagerPhase };

export type LeaderboardRow = Database["public"]["Functions"]["wager_leaderboard"]["Returns"][number];

export function racePhase(race: Pick<RaceRow, "starts_at" | "ends_at">, now: number): WagerPhase {
  if (now < new Date(race.starts_at).getTime()) return "upcoming";
  if (now < new Date(race.ends_at).getTime()) return "running";
  return "ended";
}

const RACE_COLUMNS = `id, title, currency, starts_at, ends_at, prizes, rules_md, wager_updated_at, ${CASINO_EMBED}`;

/**
 * Carrera destacada (la que está en curso; si no, la próxima; si no, la última)
 * y las anteriores. El "ahora" queda fijo durante el caché (~1 minuto): la
 * cuenta regresiva del cliente es la que marca el tiempo exacto.
 */
export async function getWagerOverview(): Promise<{ featured: PublicRace | null; past: PublicRace[] }> {
  "use cache";
  cacheTag(WAGER_TAG);
  cacheLife("hunt");

  const supabase = createPublicClient();
  if (!supabase) return { featured: null, past: [] };
  const { data } = await supabase
    .from("wager_races")
    .select(RACE_COLUMNS)
    .eq("status", "published")
    .order("ends_at", { ascending: false })
    .limit(30);

  const now = Date.now();
  const races = (data ?? []).map((r) => ({ ...r, phase: racePhase(r, now) }));
  const running = races.filter((r) => r.phase === "running").at(-1);
  const upcoming = races.filter((r) => r.phase === "upcoming").at(-1);
  const featured = running ?? upcoming ?? races[0] ?? null;
  return { featured, past: races.filter((r) => r.id !== featured?.id && r.phase === "ended") };
}

export async function getPublicRace(id: string): Promise<PublicRace | null> {
  "use cache";
  cacheTag(WAGER_TAG);
  cacheLife("hunt");

  const supabase = createPublicClient();
  if (!supabase || !z.uuid().safeParse(id).success) return null;
  const { data } = await supabase
    .from("wager_races")
    .select(RACE_COLUMNS)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  return data ? { ...data, phase: racePhase(data, Date.now()) } : null;
}

export async function getLeaderboard(raceId: string, limit = 100): Promise<LeaderboardRow[]> {
  "use cache";
  cacheTag(WAGER_TAG);
  cacheLife("hunt");

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase.rpc("wager_leaderboard", { p_race: raceId, p_limit: limit });
  return data ?? [];
}
