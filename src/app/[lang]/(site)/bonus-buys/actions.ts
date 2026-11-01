"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getActionMessages } from "@/i18n/server";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import { capitalizeWords } from "@/lib/format";
import { viewerError } from "@/lib/viewer-actions";

/** El viewer pide la máquina que quiere que se compre. */
export async function submitBuyCall(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionMessages();
  const parsed = z
    .object({
      session_id: z.uuid(),
      slot_id: z
        .union([z.uuid(), z.literal("")])
        .optional()
        .transform((v) => v || null),
      // Si lo escribe a mano, queda con las primeras letras en mayúscula (las del catálogo ya vienen bien).
      slot_name: z.string().trim().min(1, t.actions.pickSlot).max(120).transform(capitalizeWords),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.actions.checkData };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_buy_call", {
    p_session: parsed.data.session_id,
    p_slot: parsed.data.slot_id,
    p_slot_name: parsed.data.slot_name,
  });
  if (error) return { error: viewerError(t, error.message, t.actions.buys) };
  refresh();
  return { ok: t.actions.callSent };
}
