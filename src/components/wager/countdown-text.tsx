"use client";

import { useEffect, useState } from "react";

/** "3d 12h 12m" hasta `target`, actualizado cada minuto. */
export function CountdownText({ target }: { target: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <span>--</span>;
  const total = Math.max(0, Math.floor((new Date(target).getTime() - now) / 60_000));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  return <span>{d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`}</span>;
}
