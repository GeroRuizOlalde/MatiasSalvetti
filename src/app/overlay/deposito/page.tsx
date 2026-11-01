import { Suspense } from "react";
import { OverlayGate } from "@/components/overlay/overlay-gate";
import { formatMoney } from "@/lib/format";
import { isHuntActive } from "@/lib/hunt-status";
import { getPublicHunts } from "@/lib/hunts";

/**
 * Inversión del Bonus Hunt en curso: solo el monto, sin fondo ni marco, para ponerlo
 * al lado del «DEPÓSITO» que ya tiene la escena de OBS. Sin hunt en curso, un guion.
 */
export default function InvestmentOverlayPage({ searchParams }: PageProps<"/overlay/deposito">) {
  return (
    <Suspense fallback={null}>
      <OverlayGate searchParams={searchParams}>
        <InvestmentOverlay />
      </OverlayGate>
    </Suspense>
  );
}

async function InvestmentOverlay() {
  const hunt = (await getPublicHunts()).find((h) => isHuntActive(h.status));
  return (
    <p className="font-display text-4xl leading-none tracking-wide whitespace-nowrap text-gold tabular-nums">
      {hunt ? formatMoney(hunt.start_cost, hunt.currency) : "—"}
    </p>
  );
}
