"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** El cohete aparece al bajar y, al tocarlo, despega y te lleva arriba de todo. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 600);
      // Ya aterrizó arriba: queda listo para el próximo despegue.
      if (window.scrollY < 50) setLaunching(false);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const launch = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLaunching(true);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={launch}
      aria-label="Volver arriba"
      title="Volver arriba"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={cn(
        "fixed right-4 bottom-4 z-40 w-14 transition-[opacity,translate] duration-500 sm:right-6 sm:bottom-6 sm:w-16",
        "drop-shadow-[0_8px_24px_rgb(157_59_255/0.55)] hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-accent",
        visible ? "opacity-100" : "pointer-events-none translate-y-6 opacity-0",
        launching && "-translate-y-[60vh] opacity-0",
      )}
    >
      <Image src="/decor/cohete.webp" alt="" width={320} height={360} sizes="64px" className="h-auto w-full" />
    </button>
  );
}
