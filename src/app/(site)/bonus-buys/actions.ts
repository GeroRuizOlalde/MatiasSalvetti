"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import { capitalizeWords } from "@/lib/format";
import { viewerError } from "@/lib/viewer-actions";

const ERRORS: Record<string, string> = {
  calls_closed: "Los calls de esta sesión están cerrados.",
  call_already_accepted: "Tu call ya está en la sesión.",
  call_rejected: "Tu call ya fue rechazado: no podés pedir otro en esta sesión.",
  call_already_sent: "Ya mandaste tu call para esta sesión. No se puede cambiar.",
  slot_taken: "Esa máquina ya la pidió otro viewer (o ya se compró). Elegí otra.",
  invalid_slot: "Elegí un slot de la lista o escribí su nombre.",
};

const callSchema = z.object({
  session_id: z.uuid(),
  slot_id: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
  // Si lo escribe a mano, queda con las primeras letras en mayúscula (las del catálogo ya vienen bien).
  slot_name: z.string().trim().min(1, "Elegí o escribí el slot.").max(120).transform(capitalizeWords),
});

/** El viewer pide la máquina que quiere que se compre. */
export async function submitBuyCall(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = callSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_buy_call", {
    p_session: parsed.data.session_id,
    p_slot: parsed.data.slot_id,
    p_slot_name: parsed.data.slot_name,
  });
  if (error) return { error: viewerError(error.message, ERRORS) };
  refresh();
  return { ok: "¡Listo! Tu call quedó pendiente de revisión." };
}
