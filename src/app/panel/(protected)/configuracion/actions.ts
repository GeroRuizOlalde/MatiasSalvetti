"use server";

import { randomBytes } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { SETTING_SCHEMAS, SETTINGS_TAG } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

async function saveSetting(key: string, value: Json, isPublic = true): Promise<ActionState | null> {
  const profile = await requirePanelProfile("admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key, value, is_public: isPublic, updated_by: profile.id }, { onConflict: "key" });
  if (error) return { error: "No se pudo guardar." };
  updateTag(SETTINGS_TAG);
  return null;
}

/** "1.500.000" o "1500000,50" → número. Vacío → null. */
const optionalAmount = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Número inválido." });
      return z.NEVER;
    }
    return n;
  });

export async function saveSocials(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const raw = Object.fromEntries(formData);
  const socials = SETTING_SCHEMAS.socials.safeParse(raw);
  if (!socials.success) return { error: "Revisá los links: todos tienen que ser URLs completas (https://…)." };
  const platform = SETTING_SCHEMAS.primary_platform.safeParse(raw.primary_platform);
  if (!platform.success) return { error: "Plataforma inválida." };

  const failed = (await saveSetting("socials", socials.data)) ?? (await saveSetting("primary_platform", platform.data));
  return failed ?? { ok: "Redes guardadas." };
}

const homeStatsSchema = z.object({
  years_streaming: optionalAmount,
  monthly_prizes: optionalAmount,
});

export async function saveHomeStats(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = homeStatsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  return (await saveSetting("home_stats", parsed.data)) ?? { ok: "Stats guardadas." };
}

const MAX_PERKS = 4;

const partnerSchema = z.object({
  casino_slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Elegí el casino partner."),
  description: z.string().trim().min(1, "Escribí el texto del bloque.").max(400),
});

/** Bloque «Partner oficial» de la home: casino, texto y hasta 4 beneficios (etiqueta + valor). */
export async function savePartner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = partnerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const perks = Array.from({ length: MAX_PERKS }, (_, i) => ({
    label: String(formData.get(`perk_label_${i}`) ?? "")
      .trim()
      .slice(0, 60),
    value: String(formData.get(`perk_value_${i}`) ?? "")
      .trim()
      .slice(0, 30),
  })).filter((perk) => perk.label);
  return (await saveSetting("partner", { ...parsed.data, perks })) ?? { ok: "Bloque de partner guardado." };
}

const generalSchema = z.object({ min_age_days: z.coerce.number().int().min(0).max(3650) });

export async function saveGeneral(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = generalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const failed = await saveSetting("twitch_min_account_age_days", parsed.data.min_age_days);
  return failed ?? { ok: "Configuración guardada." };
}

export async function regenerateOverlayToken(): Promise<ActionState> {
  const failed = await saveSetting("overlay_token", randomBytes(24).toString("hex"), false);
  if (failed) return failed;
  refresh();
  return { ok: "Token nuevo generado. Actualizá las URLs en OBS." };
}
