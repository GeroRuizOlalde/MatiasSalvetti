import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { getPublicHunts } from "@/lib/hunts";

// Páginas públicas indexables. Las battles individuales se suman en la fase 4.
const ROUTES = [
  { path: "/", priority: 1 },
  { path: "/wager-race", priority: 0.9 },
  { path: "/bonus-hunt", priority: 0.9 },
  { path: "/bonus-buys", priority: 0.8 },
  { path: "/bonus-battle", priority: 0.8 },
  { path: "/sorteos", priority: 0.8 },
  { path: "/como-participar", priority: 0.6 },
  { path: "/juego-responsable", priority: 0.4 },
  { path: "/bases-y-condiciones", priority: 0.3 },
  { path: "/privacidad", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hunts = await getPublicHunts();
  return [
    ...ROUTES.map(({ path, priority }) => ({
      url: `${publicEnv.NEXT_PUBLIC_SITE_URL}${path}`,
      changeFrequency: "daily" as const,
      priority,
    })),
    ...hunts.map((hunt) => ({
      url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/bonus-hunt/${hunt.id}`,
      lastModified: hunt.finished_at ?? hunt.created_at,
      changeFrequency: hunt.status === "finished" ? ("monthly" as const) : ("hourly" as const),
      priority: 0.6,
    })),
  ];
}
