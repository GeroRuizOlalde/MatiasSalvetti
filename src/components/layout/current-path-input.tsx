"use client";

import { usePathname } from "next/navigation";
import { routePath } from "@/i18n/config";
import { useI18n } from "@/i18n/client";

/** Manda la ruta actual como `next` para volver acá (en el mismo idioma) después del login. */
export function CurrentPathInput() {
  const { href } = useI18n();
  return <input type="hidden" name="next" value={href(routePath(usePathname()))} />;
}
