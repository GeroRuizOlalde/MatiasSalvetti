"use client";

import { usePathname } from "next/navigation";

/** Manda la ruta actual como `next` para volver acá después del login. */
export function CurrentPathInput() {
  const pathname = usePathname();
  return <input type="hidden" name="next" value={pathname} />;
}
