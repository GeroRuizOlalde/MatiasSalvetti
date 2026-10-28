"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { CUARTEL_TAG } from "@/lib/cuartel";
import { createClient } from "@/lib/supabase/server";
import { viewerError } from "@/lib/viewer-actions";

const ERRORS: Record<string, string> = {
  mission_unavailable: "Esta misión ya no está disponible.",
  wrong_code: "Esa no es la palabra. Prestá atención al stream 👀",
  already_claimed: "Ya la reclamaste.",
  item_unavailable: "Ese premio ya no está disponible.",
  out_of_stock: "Se agotó.",
  limit_reached: "Ya llegaste al máximo de canjes de este premio.",
  level_too_low: "Todavía no tenés el nivel que pide.",
  not_enough_points: "No te alcanzan los puntos.",
};

export async function claimMission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ mission_id: z.uuid(), code: z.string().trim().max(40).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_mission", {
    p_mission: parsed.data.mission_id,
    p_code: parsed.data.code || null,
  });
  if (error) return { error: viewerError(error.message, ERRORS) };
  refresh();
  return { ok: "¡Misión cumplida!" };
}

export async function buyItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const item = z.uuid().safeParse(formData.get("item_id"));
  if (!item.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("buy_shop_item", { p_item: item.data });
  if (error) return { error: viewerError(error.message, ERRORS) };
  // El stock cambió para todos.
  updateTag(CUARTEL_TAG);
  refresh();
  return { ok: "¡Canjeado! Lo ves en «Mis canjes»." };
}
