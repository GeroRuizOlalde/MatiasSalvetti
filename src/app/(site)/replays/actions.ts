"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getReplayComments, REPLAYS_TAG, type ReplayComment } from "@/lib/replays";
import { createClient } from "@/lib/supabase/server";
import { viewerError } from "@/lib/viewer-actions";

const ERRORS: Record<string, string> = {
  invalid_url: "Pegá el link completo del replay (empieza con https://).",
  invalid_slot: "Elegí o escribí el slot.",
  invalid_amount: "Revisá los montos.",
  invalid_note: "El comentario es muy largo.",
  invalid_comment: "Escribí un comentario (hasta 300 letras).",
  replay_duplicate: "Ese replay ya lo compartió alguien.",
  too_many_pending: "Tenés 5 replays esperando revisión. Esperá a que el panel los revise.",
  not_found: "Ese replay ya no está publicado.",
};

/** Monto opcional (vacío = null). `positive`: tiene que ser mayor a 0. */
const amount = (message: string, positive = true) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || (positive ? n <= 0 : n < 0) || n > 999_999_999_999) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return n;
    });

const schema = z.object({
  url: z.string().trim().min(1, "Pegá el link del replay.").max(500, "El link es muy largo."),
  slot_id: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
  slot_name: z.string().trim().min(1, "Elegí o escribí el slot.").max(120),
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  bet: amount("La apuesta tiene que ser mayor a 0."),
  bonus_cost: amount("El valor del bono tiene que ser mayor a 0."),
  payout: amount("Lo que pagó tiene que ser un número mayor o igual a 0.", false),
  note: z.string().trim().max(200, "El comentario es muy largo.").optional(),
});

export async function submitReplay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { url, slot_id, slot_name, currency, bet, bonus_cost, payout, note } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_replay", {
    p_url: url,
    p_slot: slot_id,
    p_slot_name: slot_name,
    p_note: note || null,
    p_currency: currency,
    p_bet: bet,
    p_bonus_cost: bonus_cost,
    p_payout: payout,
  });
  if (error) return { error: viewerError(error.message, ERRORS) };
  refresh();
  return { ok: "¡Listo! Tu replay se publica cuando lo revise el panel." };
}

export async function deleteMyReplay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("replays").delete().eq("id", parsed.data.id).select("id");
  if (error || !data?.length) return { error: "No se pudo borrar: puede que ya lo hayan revisado." };
  updateTag(REPLAYS_TAG);
  refresh();
  return { ok: "Replay borrado." };
}

// -----------------------------------------------------------------------------
// Me gusta y comentarios (se llaman desde el feed, sin formulario)
// -----------------------------------------------------------------------------

export async function toggleReplayLike(replayId: string): Promise<{ liked: boolean } | { error: string }> {
  if (!z.uuid().safeParse(replayId).success) return { error: "Datos inválidos." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_replay_like", { p_replay: replayId });
  if (error) return { error: viewerError(error.message, ERRORS) };
  updateTag(REPLAYS_TAG);
  return { liked: Boolean(data) };
}

export async function loadReplayComments(replayId: string): Promise<ReplayComment[]> {
  if (!z.uuid().safeParse(replayId).success) return [];
  return getReplayComments(replayId);
}

export async function addReplayComment(replayId: string, body: string): Promise<{ ok: true } | { error: string }> {
  if (!z.uuid().safeParse(replayId).success) return { error: "Datos inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_replay_comment", { p_replay: replayId, p_body: body });
  if (error) return { error: viewerError(error.message, ERRORS) };
  updateTag(REPLAYS_TAG);
  return { ok: true };
}

export async function deleteReplayComment(commentId: string): Promise<{ ok: true } | { error: string }> {
  if (!z.uuid().safeParse(commentId).success) return { error: "Datos inválidos." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("replay_comments").delete().eq("id", commentId).select("id");
  if (error || !data?.length) return { error: "No se pudo borrar el comentario." };
  updateTag(REPLAYS_TAG);
  return { ok: true };
}
