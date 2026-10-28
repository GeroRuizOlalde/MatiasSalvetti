"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { battleTag } from "@/lib/battles";
import { createClient } from "@/lib/supabase/server";
import { viewerError } from "@/lib/viewer-actions";

export async function pickEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const entry = z.uuid().safeParse(formData.get("entry_id"));
  if (!entry.success) return { error: "Elegí un slot." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("pick_battle_entry", { p_entry: entry.data });
  if (error)
    return { error: viewerError(error.message, { picks_closed: "La battle ya arrancó: no se puede cambiar." }) };
  // Quien vota ve su voto en el conteo enseguida (la base limita a 10 por minuto).
  const owner = z.uuid().safeParse(formData.get("battle_id"));
  if (owner.success) updateTag(battleTag(owner.data));
  refresh();
  return { ok: "¡Listo! Podés cambiarlo hasta que arranque la battle." };
}
