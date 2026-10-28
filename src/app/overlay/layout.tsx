import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Overlay", robots: { index: false, follow: false } };

/** Sin header ni footer y con fondo transparente para usar como fuente de navegador en OBS. */
export default function OverlayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{"html,body{background:transparent!important}"}</style>
      <div className="p-3 text-text">{children}</div>
    </>
  );
}
