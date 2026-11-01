"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getActionMessages } from "@/i18n/server";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import { capitalizeWords } from "@/lib/format";
import { viewerError } from "@/lib/viewer-actions";

const callSchema = (pickSlot: string) =>
  z.object({
    hunt_id: z.uuid(),
    slot_id: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    // Si lo escribe a mano, queda con las primeras letras en mayúscula (las del catálogo ya vienen bien).
    slot_name: z.string().trim().min(1, pickSlot).max(120).transform(capitalizeWords),
  });

export async function submitCall(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionMessages();
  const parsed = callSchema(t.actions.pickSlot).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.actions.checkData };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_hunt_call", {
    p_hunt: parsed.data.hunt_id,
    p_slot: parsed.data.slot_id,
    p_slot_name: parsed.data.slot_name,
  });
  if (error) return { error: viewerError(t, error.message, t.actions.hunt) };
  refresh();
  return { ok: t.actions.callSent };
}

export async function submitGuess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionMessages();
  const g = t.actions.guess;
  const parsed = z
    .object({
      hunt_id: z.uuid(),
      amount: z.coerce.number({ error: g.amountRequired }).min(0, g.negative).max(999_999_999_999, g.tooBig),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? g.check };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_hunt_guess", {
    p_hunt: parsed.data.hunt_id,
    p_amount: parsed.data.amount,
  });
  if (error) return { error: viewerError(t, error.message, t.actions.hunt) };
  refresh();
  return { ok: g.saved };
}
