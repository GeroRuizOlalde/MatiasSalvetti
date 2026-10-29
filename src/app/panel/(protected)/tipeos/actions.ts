"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { friendlyError } from "@/lib/panel-forms";
import { createClient } from "@/lib/supabase/server";

export type ViewerOption = { id: string; name: string; login: string | null; avatarUrl: string | null };

/** Busca usuarios por nombre o usuario de Twitch para el tipeo a mano. */
export async function searchViewers(query: string): Promise<ViewerOption[]> {
  await requirePanelProfile("mod");
  // Sin comodines ni comas: va dentro de un filtro de PostgREST.
  const q = query
    .trim()
    .replace(/[%_,()*\\]/g, "")
    .slice(0, 40);
  if (q.length < 2) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, twitch_login, avatar_url")
    .or(`twitch_login.ilike.%${q}%,display_name.ilike.%${q}%`)
    .is("banned_at", null)
    .order("display_name")
    .limit(8);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.display_name || p.twitch_login || "Usuario",
    login: p.twitch_login,
    avatarUrl: p.avatar_url,
  }));
}

const ERRORS: Record<string, string> = {
  invalid_note: "Escribí una descripción (hasta 300 caracteres).",
  not_found: "No encontramos a ese usuario.",
  forbidden: "No tenés permisos para esto.",
};

const manualSchema = z.object({
  user_id: z.uuid({ error: "Elegí un usuario." }),
  note: z
    .string()
    .trim()
    .min(1, "Escribí una descripción.")
    .max(300, "La descripción puede tener hasta 300 caracteres."),
  slot_name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || null),
});

/** Da un tipeo a un usuario sin que venga de un bono, con una descripción del motivo. */
export async function giveManualTipeo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("give_manual_tipeo", {
    p_user: parsed.data.user_id,
    p_note: parsed.data.note,
    p_slot: parsed.data.slot_name,
  });
  if (error) return { error: friendlyError(ERRORS, error.message, "No se pudo dar el tipeo. Probá de nuevo.") };
  refresh();
  return { ok: "¡Tipeo dado! Le llegó la notificación." };
}
