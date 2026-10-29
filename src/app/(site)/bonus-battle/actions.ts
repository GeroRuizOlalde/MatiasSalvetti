"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import { capitalizeWords } from "@/lib/format";
import { viewerError } from "@/lib/viewer-actions";

const ERRORS: Record<string, string> = {
  calls_closed: "Los calls de esta battle están cerrados.",
  call_already_accepted: "Tu slot ya está en la battle.",
  call_rejected: "Tu call ya fue rechazado: no podés pedir otro en esta battle.",
  call_already_sent: "Ya mandaste tu call para esta battle. No se puede cambiar.",
  slot_taken: "Esa máquina ya la pidió otro viewer. Elegí otra.",
  battle_full: "El cuadro ya está completo.",
  invalid_slot: "Elegí un slot de la lista o escribí su nombre.",
};

const callSchema = z.object({
  battle_id: z.uuid(),
  slot_id: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
  // Si lo escribe a mano, queda con las primeras letras en mayúscula (las del catálogo ya vienen bien).
  slot_name: z.string().trim().min(1, "Elegí o escribí el slot.").max(120).transform(capitalizeWords),
});

/** El viewer callea el slot con el que entra a la battle. */
export async function submitBattleCall(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = callSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_battle_call", {
    p_battle: parsed.data.battle_id,
    p_slot: parsed.data.slot_id,
    p_slot_name: parsed.data.slot_name,
  });
  if (error) return { error: viewerError(error.message, ERRORS) };
  refresh();
  return { ok: "¡Listo! Tu call quedó pendiente de revisión." };
}
