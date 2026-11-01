"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requirePanelProfile } from "@/lib/auth/session";
import { SETTINGS_TAG } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export type StreamStatusState = { ok?: boolean; error?: string };

const schema = z.object({ live: z.literal("on").optional(), platform: z.enum(["twitch", "kick"]) });

export async function updateStreamStatus(_prev: StreamStatusState, formData: FormData): Promise<StreamStatusState> {
  await requirePanelProfile("mod");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };

  const { live, platform } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("site_settings")
    .update({ value: { live: live === "on", platform } })
    .eq("key", "stream_manual");

  if (error) return { error: "No se pudo guardar. Probá de nuevo." };
  updateTag(SETTINGS_TAG);
  return { ok: true };
}
