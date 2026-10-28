import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { DEFAULT_LEVEL_CURVE } from "@/lib/calc/levels";
import { createPublicClient } from "@/lib/supabase/public";

export const SETTINGS_TAG = "site-settings";

const platformSchema = z.enum(["twitch", "kick"]);
export type Platform = z.infer<typeof platformSchema>;

const socialsSchema = z.object({
  twitch: z.url(),
  kick: z.url(),
  youtube: z.url(),
  instagram: z.url(),
  tiktok: z.url(),
  discord: z.url(),
  whatsapp: z.url(),
});
export type Socials = z.infer<typeof socialsSchema>;

export const SETTING_SCHEMAS = {
  socials: socialsSchema,
  primary_platform: platformSchema,
  stream_manual: z.object({ live: z.boolean(), platform: platformSchema }),
  next_stream: z.object({ at: z.iso.datetime({ offset: true }).nullable(), label: z.string().nullable() }),
  home_stats: z.object({
    years_streaming: z.number().nullable(),
    monthly_prizes: z.number().nullable(),
  }),
  responsible_gaming_helpline: z.string(),
  twitch_min_account_age_days: z.number().int().min(0),
  level_curve: z.object({ base: z.number().positive(), exponent: z.number().positive() }),
};

export type PublicSettings = { [K in keyof typeof SETTING_SCHEMAS]: z.infer<(typeof SETTING_SCHEMAS)[K]> };

export const DEFAULT_SETTINGS: PublicSettings = {
  socials: {
    twitch: "https://www.twitch.tv/Chupetti",
    kick: "https://kick.com/chupetti",
    youtube: "https://www.youtube.com/@ChupettiClips",
    instagram: "https://www.instagram.com/chupetticlips/",
    tiktok: "https://www.tiktok.com/@chupetticlips",
    discord: "https://discord.com/invite/ywKHXWNH4C",
    whatsapp: "https://chat.whatsapp.com/GSwm8Vhu2yNFa1cL7smvBT",
  },
  primary_platform: "twitch",
  stream_manual: { live: false, platform: "twitch" },
  next_stream: { at: null, label: null },
  home_stats: { years_streaming: null, monthly_prizes: null },
  responsible_gaming_helpline: "[LÍNEA DE AYUDA]",
  twitch_min_account_age_days: 0,
  level_curve: DEFAULT_LEVEL_CURVE,
};

/** Configuración pública, cacheada. Si falta Supabase o un valor es inválido, usa el default. */
export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("hours");

  const supabase = createPublicClient();
  if (!supabase) return DEFAULT_SETTINGS;

  const { data, error } = await supabase.from("site_settings").select("key, value").eq("is_public", true);
  if (error || !data) return DEFAULT_SETTINGS;

  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of data) {
    const schema = SETTING_SCHEMAS[row.key as keyof typeof SETTING_SCHEMAS];
    if (!schema) continue;
    const parsed = schema.safeParse(row.value);
    if (parsed.success) settings[row.key] = parsed.data;
  }
  return settings as PublicSettings;
}
