import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

// Páginas públicas indexables. Los hunts y battles individuales se suman en sus fases.
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

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map(({ path, priority }) => ({
    url: `${publicEnv.NEXT_PUBLIC_SITE_URL}${path}`,
    changeFrequency: "daily",
    priority,
  }));
}
