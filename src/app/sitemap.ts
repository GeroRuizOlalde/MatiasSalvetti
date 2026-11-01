import type { MetadataRoute } from "next";
import { LOCALES, localePath } from "@/i18n/config";
import { publicEnv } from "@/lib/env";
import { getPublicBattles } from "@/lib/battles";
import { getPublicBuySessions } from "@/lib/buys";
import { getPublicHunts } from "@/lib/hunts";
import { getWagerOverview } from "@/lib/wager";

// Páginas públicas indexables, más cada hunt, sesión de buys y battle publicados. Cada una va en
// español y en inglés, con el link a la otra versión.
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
  const site = publicEnv.NEXT_PUBLIC_SITE_URL;
  const inBothLanguages = (path: string, entry: Omit<MetadataRoute.Sitemap[number], "url">) => {
    const languages = Object.fromEntries(LOCALES.map((lang) => [lang, `${site}${localePath(lang, path)}`]));
    return LOCALES.map((lang) => ({ ...entry, url: languages[lang], alternates: { languages } }));
  };
  const detail = (path: string, finished: boolean, lastModified: string) =>
    inBothLanguages(path, { lastModified, changeFrequency: finished ? "monthly" : "hourly", priority: 0.6 });
  return [
    ...ROUTES.flatMap(({ path, priority }) => inBothLanguages(path, { changeFrequency: "daily", priority })),
    ...hunts.flatMap((h) => detail(`/bonus-hunt/${h.id}`, h.status === "finished", h.finished_at ?? h.created_at)),
    ...buys.flatMap((b) => detail(`/bonus-buys/${b.id}`, b.status === "finished", b.finished_at ?? b.created_at)),
    ...battles.flatMap((b) => detail(`/bonus-battle/${b.id}`, b.status === "finished", b.finished_at ?? b.created_at)),
    ...wager.past.flatMap((r) => detail(`/wager-race/${r.id}`, true, r.ends_at)),
  ];
}
