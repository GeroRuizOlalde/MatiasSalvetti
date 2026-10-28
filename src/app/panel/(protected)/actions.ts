"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requirePanelProfile } from "@/lib/auth/session";
import { SETTINGS_TAG } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export type StreamStatusState = { ok?: boolean; error?: string };

const schema = z.object({
  live: z.literal("on").optional(),
  platform: z.enum(["twitch", "kick"]),
  // <input type="datetime-local"> no trae zona: se interpreta en hora de Argentina (UTC-3, sin horario de verano).
  next_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha inválida")
    .or(z.literal(""))
    .optional(),
  next_label: z.string().trim().max(60).optional(),
});

export async function updateStreamStatus(_prev: StreamStatusState, formData: FormData): Promise<StreamStatusState> {
  await requirePanelProfile("mod");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };

  const { live, platform, next_at, next_label } = parsed.data;
  const supabase = await createClient();

  const results = await Promise.all([
    supabase
      .from("site_settings")
      .update({ value: { live: live === "on", platform } })
      .eq("key", "stream_manual"),
    supabase
      .from("site_settings")
      .update({
        value: {
          at: next_at ? new Date(`${next_at}:00-03:00`).toISOString() : null,
          label: next_label || null,
        },
      })
      .eq("key", "next_stream"),
  ]);

  if (results.some((r) => r.error)) return { error: "No se pudo guardar. Probá de nuevo." };
  updateTag(SETTINGS_TAG);
  return { ok: true };
}
