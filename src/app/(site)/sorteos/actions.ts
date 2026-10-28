"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { GIVEAWAYS_TAG } from "@/lib/giveaways";
import { createClient } from "@/lib/supabase/server";
import { viewerError } from "@/lib/viewer-actions";

const ERRORS: Record<string, string> = {
  giveaway_closed: "Este sorteo no está abierto.",
  level_too_low: "Todavía no tenés el nivel que pide este sorteo.",
  casino_not_verified: "Para este sorteo necesitás una cuenta verificada en el casino.",
  already_entered: "Ya estás participando.",
  max_tickets_reached: "Ya pusiste el máximo de tickets.",
  not_enough_tickets: "No tenés tickets suficientes. Conseguilos en la tienda del Cuartel.",
};

export async function enterGiveaway(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ giveaway_id: z.uuid(), tickets: z.coerce.number().int().min(1).max(1000).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Revisá la cantidad de tickets." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enter_giveaway", {
    p_giveaway: parsed.data.giveaway_id,
    p_tickets: parsed.data.tickets ?? 1,
  });
  if (error) return { error: viewerError(error.message, ERRORS) };
  updateTag(GIVEAWAYS_TAG);
  refresh();
  return { ok: data && data > 1 ? `¡Listo! Tenés ${data} chances.` : "¡Listo! Ya estás participando." };
}
