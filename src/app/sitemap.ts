import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { getPublicBattles } from "@/lib/battles";
import { getPublicBuySessions } from "@/lib/buys";
import { getPublicHunts } from "@/lib/hunts";
import { getWagerOverview } from "@/lib/wager";

// Páginas públicas indexables, más cada hunt, sesión de buys y battle publicados.
const ROUTES = [
  { path: "/", priority: 1 },
  { path: "/wager-race", priority: 0.9 },
  { path: "/bonus-hunt", priority: 0.9 },
  { path: "/bonus-buys", priority: 0.8 },
  { path: "/bonus-battle", priority: 0.8 },
  { path: "/sorteos", priority: 0.8 },
  { path: "/replays", priority: 0.7 },
  { path: "/como-participar", priority: 0.6 },
  { path: "/bases-y-condiciones", priority: 0.3 },
  { path: "/privacidad", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [hunts, buys, battles, wager] = await Promise.all([
    getPublicHunts(),
    getPublicBuySessions(),
    getPublicBattles(),
    getWagerOverview(),
  ]);
  const detail = (path: string, finished: boolean, lastModified: string) => ({
    url: `${publicEnv.NEXT_PUBLIC_SITE_URL}${path}`,
    lastModified,
    changeFrequency: finished ? ("monthly" as const) : ("hourly" as const),
    priority: 0.6,
  });
  return [
    ...ROUTES.map(({ path, priority }) => ({
      url: `${publicEnv.NEXT_PUBLIC_SITE_URL}${path}`,
      changeFrequency: "daily" as const,
      priority,
    })),
    ...hunts.map((h) => detail(`/bonus-hunt/${h.id}`, h.status === "finished", h.finished_at ?? h.created_at)),
    ...buys.map((b) => detail(`/bonus-buys/${b.id}`, b.status === "finished", b.finished_at ?? b.created_at)),
    ...battles.map((b) => detail(`/bonus-battle/${b.id}`, b.status === "finished", b.finished_at ?? b.created_at)),
    ...wager.past.map((r) => detail(`/wager-race/${r.id}`, true, r.ends_at)),
  ];
}
