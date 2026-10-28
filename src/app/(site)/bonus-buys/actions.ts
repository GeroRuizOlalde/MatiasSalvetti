"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { buySessionTag } from "@/lib/buys";
import { createClient } from "@/lib/supabase/server";
import { viewerError } from "@/lib/viewer-actions";

export async function castVote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const option = z.uuid().safeParse(formData.get("option_id"));
  if (!option.success) return { error: "Elegí una opción." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cast_buy_vote", { p_option: option.data });
  if (error) return { error: viewerError(error.message, { poll_closed: "La votación ya se cerró." }) };
  // Quien vota ve su voto en el conteo enseguida (la base limita a 10 por minuto).
  const owner = z.uuid().safeParse(formData.get("session_id"));
  if (owner.success) updateTag(buySessionTag(owner.data));
  refresh();
  return { ok: "¡Voto guardado! Podés cambiarlo mientras esté abierta." };
}
