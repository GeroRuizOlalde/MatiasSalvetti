"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    días: Math.floor(total / 86400),
    hs: Math.floor((total % 86400) / 3600),
    min: Math.floor((total % 3600) / 60),
    seg: total % 60,
  };
}

/** Cuenta regresiva hasta `target`. Antes de hidratar muestra guiones para no desfasar server y cliente. */
export function Countdown({ target, label }: { target: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const values = now === null ? null : parts(new Date(target).getTime() - now);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">{label}</p>
      <dl className="flex gap-2" aria-live="off">
        {(["días", "hs", "min", "seg"] as const).map((unit) => (
          <div key={unit} className="w-16 rounded-lg border border-gold/30 bg-surface-2 px-2 py-2 text-center">
            <dd className="num text-2xl font-bold text-gold">
              {values ? String(values[unit]).padStart(2, "0") : "--"}
            </dd>
            <dt className="text-[10px] text-subtle uppercase">{unit}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
