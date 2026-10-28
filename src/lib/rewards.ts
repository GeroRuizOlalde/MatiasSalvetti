import type { PublicSettings } from "@/lib/settings";

export type RewardKind = keyof PublicSettings["rewards"];

/** Premios automáticos por participar (setting `rewards`, en el mismo orden que el panel). */
export const REWARD_KINDS: { key: RewardKind; label: string; description: string }[] = [
  { key: "hunt_call", label: "Call aceptado", description: "Cuando aceptan tu slot en un Bonus Hunt o en Bonus Buys." },
  { key: "gtb_participation", label: "Adiviná el balance", description: "Por apostar en el GTB, al terminar el hunt." },
  { key: "gtb_win", label: "Ganar el GTB", description: "Extra para el que más se acercó al balance final." },
  { key: "battle_pick", label: "Bancar en la Battle", description: "Por elegir slot, cuando termina la battle." },
  { key: "battle_champion", label: "Bancar al campeón", description: "Extra si tu slot ganó la battle." },
];

/** Texto de cada movimiento del historial (`point_events.kind`). */
export const POINT_KIND_LABEL: Record<string, string> = {
  ...Object.fromEntries(REWARD_KINDS.map((r) => [r.key, r.label])),
  // Las votaciones de Buys se reemplazaron por calls; queda para el historial.
  buy_vote: "Votar en Buys",
  mission: "Misión",
  shop: "Canje en la tienda",
  shop_refund: "Reintegro de canje",
  admin_adjust: "Ajuste",
};
