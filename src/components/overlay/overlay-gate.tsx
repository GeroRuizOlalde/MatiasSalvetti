import type { ReactNode } from "react";
import { isValidOverlayKey } from "@/lib/overlay";
import { AutoRefresh } from "./auto-refresh";

export const overlayPanel = "rounded-2xl border border-white/10 bg-[#0b0712]/85 p-4 shadow-2xl backdrop-blur";

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
