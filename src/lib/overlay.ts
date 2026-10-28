import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { SETTINGS_TAG } from "@/lib/settings";
import { createPublicClient } from "@/lib/supabase/public";

/** ¿El ?key= de un overlay es el token vigente? Se invalida al regenerarlo (tag de settings). */
export async function isValidOverlayKey(key: string): Promise<boolean> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("hours");

  const supabase = createPublicClient();
  if (!supabase || key.length < 16 || key.length > 200) return false;
  const { data } = await supabase.rpc("check_overlay_token", { p_key: key });
  return data === true;
}

export const OVERLAYS = [
  {
    path: "hunt",
    label: "Bonus Hunt",
    size: "480 × 900",
    description: "Números del hunt en curso y la lista de bonos.",
  },
  {
    path: "buys",
    label: "Bonus Buys",
    size: "480 × 700",
    description: "Resultado de la sesión y la votación abierta.",
  },
  { path: "battle", label: "Bonus Battle", size: "1280 × 360", description: "El cruce en juego y el cuadro." },
  { path: "wager", label: "Wager Race", size: "420 × 520", description: "Cuenta regresiva y top 5." },
  {
    path: "sorteo",
    label: "Sorteo",
    size: "560 × 260",
    description: "Sorteo abierto: premio, anotados y cuenta regresiva.",
  },
] as const;
