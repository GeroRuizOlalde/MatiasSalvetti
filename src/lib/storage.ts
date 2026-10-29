import { publicEnv } from "@/lib/env";

export const PUBLIC_ASSETS_BUCKET = "public-assets";

/** URL pública de un archivo del bucket `public-assets`, o null si falta algo. */
export function publicAssetUrl(path: string | null | undefined) {
  if (!path || !publicEnv.NEXT_PUBLIC_SUPABASE_URL) return null;
  const clean = path.split("/").map(encodeURIComponent).join("/");
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PUBLIC_ASSETS_BUCKET}/${clean}`;
}

/** Logos que vienen con la web, por slug del casino. Uno subido desde el panel tiene prioridad. */
const BUILT_IN_CASINO_LOGOS: Record<string, string> = {
  "1xslots": "/brand/1xslots.png",
  winebet: "/brand/casinos/winebet.png",
};

export function casinoLogoUrl(casino: { slug: string; logo_path: string | null }) {
  return publicAssetUrl(casino.logo_path) ?? BUILT_IN_CASINO_LOGOS[casino.slug] ?? null;
}
