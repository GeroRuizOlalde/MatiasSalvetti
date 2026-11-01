import type { ReactNode } from "react";
import { isValidOverlayKey } from "@/lib/overlay";
import { AutoRefresh } from "./auto-refresh";

/**
 * Fondo de los overlays: sólido para que se lea sobre cualquier escena, sin borde ni
 * brillo (el marco lo pone OBS).
 */
export const overlayPanel = "rounded-2xl bg-[#120a20] p-4";

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
