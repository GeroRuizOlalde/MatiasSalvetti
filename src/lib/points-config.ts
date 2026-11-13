import type { PointsConfig } from "@/lib/settings";

/** Campos de `points_config`, agrupados como se muestran en el panel. */
export const POINTS_CONFIG_GROUPS: {
  title: string;
  description: string;
  fields: { key: keyof PointsConfig; label: string; min?: number }[];
}[] = [
  {
    title: "Ver el stream",
    description: "Se suma solo mientras el canal está en vivo.",
    fields: [
      { key: "watch_points", label: "Puntos" },
      { key: "watch_interval_minutes", label: "Cada (minutos)", min: 1 },
    ],
  },
  {
    title: "Chat",
    description: "Por mensaje, con tope por minuto. Los repetidos no cuentan.",
    fields: [
      { key: "chat_points", label: "Puntos por mensaje" },
      { key: "chat_per_minute", label: "Mensajes por minuto", min: 1 },
    ],
  },
  {
    title: "Bonus diario",
    description: "Se reclama en la web. La racha suma un porcentaje por cada día seguido.",
    fields: [
      { key: "daily_points", label: "Puntos" },
      { key: "daily_streak_step_pct", label: "Racha: % por día" },
      { key: "daily_streak_cap_pct", label: "Racha: tope %" },
    ],
  },
  {
    title: "Apoyo al canal",
    description: "Follow y subs pagan una vez por evento. Los bits, por cada bit.",
    fields: [
      { key: "follow_points", label: "Follow" },
      { key: "sub_points", label: "Sub o resub" },
      { key: "gift_sub_points", label: "Sub regalada (c/u)" },
      { key: "bit_points", label: "Por bit" },
    ],
  },
];

export const POINTS_CONFIG_KEYS = POINTS_CONFIG_GROUPS.flatMap((g) => g.fields);

/** Cuánto paga el bonus en el día N de racha (igual que `daily_bonus_points` en la base). */
export function dailyBonusPoints(config: PointsConfig, streak: number) {
  const extra = Math.min(Math.max(streak - 1, 0) * config.daily_streak_step_pct, config.daily_streak_cap_pct);
  return Math.round(config.daily_points * (1 + extra / 100));
}

/** Niveles que dan badge. */
export const LEVEL_BADGES = [10, 25, 50] as const;

export function levelBadge(level: number) {
  return [...LEVEL_BADGES].reverse().find((l) => level >= l) ?? null;
}
