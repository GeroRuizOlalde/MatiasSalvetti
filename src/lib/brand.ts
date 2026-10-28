import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const BRAND_ASSETS = {
  logo: { src: "/brand/logo-ms.png", width: 300, height: 240 },
  personaje: { src: "/brand/personaje.png", width: 1080, height: 1350 },
} as const;

/** Los PNG de marca los agrega Matías; hasta entonces se muestra un placeholder. */
export function hasBrandAsset(name: keyof typeof BRAND_ASSETS) {
  return existsSync(join(process.cwd(), "public", BRAND_ASSETS[name].src));
}
