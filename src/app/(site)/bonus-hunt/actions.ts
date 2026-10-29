"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import { capitalizeWords } from "@/lib/format";
import { viewerError } from "@/lib/viewer-actions";

const ERRORS: Record<string, string> = {
  calls_closed: "Los calls de este hunt ya están cerrados.",
  call_already_accepted: "Tu call ya está en el hunt.",
  call_already_sent: "Ya mandaste tu call para este hunt. No se puede cambiar.",
  slot_taken: "Esa máquina ya la pidió otro viewer (o ya está en el hunt). Elegí otra.",
  invalid_slot: "Elegí un slot de la lista o escribí su nombre.",
  guesses_closed: "Las apuestas del balance ya están cerradas.",
  invalid_amount: "Revisá el monto.",
};

const friendly = (message: string) => viewerError(message, ERRORS);

const callSchema = z.object({
  hunt_id: z.uuid(),
  slot_id: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
  // Si lo escribe a mano, queda con las primeras letras en mayúscula (las del catálogo ya vienen bien).
  slot_name: z.string().trim().min(1, "Elegí o escribí el slot.").max(120).transform(capitalizeWords),
});

export async function submitCall(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = callSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_hunt_call", {
    p_hunt: parsed.data.hunt_id,
    p_slot: parsed.data.slot_id,
    p_slot_name: parsed.data.slot_name,
  });
  if (error) return { error: friendly(error.message) };
  refresh();
  return { ok: "¡Listo! Tu call quedó pendiente de revisión." };
}

const guessSchema = z.object({
  hunt_id: z.uuid(),
  amount: z.coerce
    .number({ error: "Poné un monto." })
    .min(0, "El monto no puede ser negativo.")
    .max(999_999_999_999, "Ese monto es demasiado grande."),
});

export async function submitGuess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = guessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá el monto." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_hunt_guess", {
    p_hunt: parsed.data.hunt_id,
    p_amount: parsed.data.amount,
  });
  if (error) return { error: friendly(error.message) };
  refresh();
  return { ok: "¡Apuesta guardada! Podés cambiarla mientras esté abierto." };
}
