"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { friendlyError } from "@/lib/panel-forms";
import { createClient } from "@/lib/supabase/server";
import { WAGER_TAG } from "@/lib/wager";

const schema = z.object({
  id: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(200).optional(),
});

export async function reviewAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };
  const { id, decision, reason } = parsed.data;
  if (decision === "reject" && !reason) return { error: "Contale al viewer por qué se rechaza." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_casino_account", {
    p_id: id,
    p_approve: decision === "approve",
    p_reason: reason ?? null,
  });
  if (error) {
    return {
      error: friendlyError({ forbidden: "Solo el admin revisa cuentas." }, error.message, "No se pudo guardar."),
    };
  }
  // Aprobar o rechazar cambia quién aparece en los rankings.
  updateTag(WAGER_TAG);
  refresh();
  return { ok: decision === "approve" ? "Cuenta aprobada." : "Cuenta rechazada." };
}
