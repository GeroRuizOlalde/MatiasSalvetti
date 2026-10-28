"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Los overlays de OBS se vuelven a pedir cada pocos segundos (el panel invalida el caché en cada cambio). */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
