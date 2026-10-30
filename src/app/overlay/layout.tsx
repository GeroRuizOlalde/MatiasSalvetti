import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Overlay", robots: { index: false, follow: false } };

/** Sin header ni footer y con fondo transparente para usar como fuente de navegador en OBS. */
export default function OverlayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{"html,body{background:transparent!important}"}</style>
      {/* Grises más claros que en la web: en el stream el overlay se ve chico y sobre video. */}
      <div className="p-3 text-text [--color-muted:#ece4f7] [--color-subtle:#cfc2e6] [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]">
        {children}
      </div>
    </>
  );
}
