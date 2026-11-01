import "server-only";
import { getPublicGiveaways } from "@/lib/giveaways";
import { getWagerOverview } from "@/lib/wager";

/**
 * Qué mostrar en el lugar del «EN VIVO» cuando Chupetti está offline, por prioridad:
 * un sorteo abierto, la Wager Race en curso o, si no hay nada, seguirlo en Twitch.
 */
export type OfflineHighlight =
  | { kind: "giveaway"; title: string; endsAt: string }
  | { kind: "wager"; title: string; endsAt: string }
  | { kind: "follow" };

export async function getOfflineHighlight(): Promise<OfflineHighlight> {
  const [giveaways, wager] = await Promise.all([getPublicGiveaways(), getWagerOverview()]);
  const giveaway = giveaways.find((g) => g.phase === "open");
  if (giveaway) return { kind: "giveaway", title: giveaway.title, endsAt: giveaway.ends_at };
  const race = wager.featured;
  if (race?.phase === "running") return { kind: "wager", title: race.title, endsAt: race.ends_at };
  return { kind: "follow" };
}
