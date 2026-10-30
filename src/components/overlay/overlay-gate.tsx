import type { ReactNode } from "react";
import { isValidOverlayKey } from "@/lib/overlay";
import { AutoRefresh } from "./auto-refresh";

/**
 * Cuadro de los overlays: sólido y con borde brillante para que se lea sobre cualquier
 * fondo del stream (los semitransparentes se pierden sobre escenas claras o rosas).
 */
export const overlayPanel =
  "relative overflow-hidden rounded-2xl border-2 border-accent bg-[#120a20] p-4 pt-5 shadow-[0_0_28px_-6px_rgb(157_59_255/0.9)] before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:bg-gradient-to-r before:from-accent before:via-[#ff5fd2] before:to-gold";

/** Valida el ?key= y agrega el refresco automático. */
export async function OverlayGate({
  searchParams,
  children,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  children: ReactNode;
}) {
  const { key } = await searchParams;
  if (typeof key !== "string" || !(await isValidOverlayKey(key))) {
    return (
      <p className={`${overlayPanel} max-w-sm text-sm text-live`}>
        Overlay sin permiso: copiá la URL completa (con <code>?key=</code>) desde Panel → Configuración.
      </p>
    );
  }
  return (
    <>
      <AutoRefresh />
      {children}
    </>
  );
}
