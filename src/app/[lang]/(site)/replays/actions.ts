"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { getActionMessages } from "@/i18n/server";
import type { Messages } from "@/i18n/messages";
import type { ActionState } from "@/lib/action-state";
import { getReplayComments, REPLAYS_TAG, type ReplayComment } from "@/lib/replays";
import { createClient } from "@/lib/supabase/server";
import { viewerError } from "@/lib/viewer-actions";

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

const replaySchema = (t: Messages) => {
  const m = t.actions.replay;
  return z.object({
    url: z.string().trim().min(1, m.pasteLink).max(500, m.linkTooLong),
    slot_id: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    slot_name: z.string().trim().min(1, t.actions.pickSlot).max(120),
    currency: z.enum(["ARS", "USD"]).default("ARS"),
    bet: amount(m.bet),
    bonus_cost: amount(m.bonus),
    payout: amount(m.payout, false),
    multi: amount(m.multi),
    note: z.string().trim().max(200, m.noteTooLong).optional(),
  });
};

export async function submitReplay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionMessages();
  const parsed = replaySchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.actions.checkData };
  const { url, slot_id, slot_name, currency, bet, bonus_cost, payout, multi, note } = parsed.data;

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
    p_multi: multi,
  });
  if (error) return { error: viewerError(t, error.message, t.actions.replays) };
  refresh();
  return { ok: t.actions.replay.sent };
}

export async function updateReplay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionMessages();
  const parsed = replaySchema(t).extend({ id: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.actions.checkData };
  const { id, url, slot_id, slot_name, currency, bet, bonus_cost, payout, multi, note } = parsed.data;

  const supabase = await createClient();
  const { data: before } = await supabase.from("replays").select("status").eq("id", id).maybeSingle();
  const { error } = await supabase.rpc("update_replay", {
    p_id: id,
    p_url: url,
    p_slot: slot_id,
    p_slot_name: slot_name,
    p_note: note || null,
    p_currency: currency,
    p_bet: bet,
    p_bonus_cost: bonus_cost,
    p_payout: payout,
    p_multi: multi,
  });
  if (error) return { error: viewerError(t, error.message, t.actions.replays) };
  const { data: after } = await supabase.from("replays").select("status").eq("id", id).maybeSingle();
  updateTag(REPLAYS_TAG);
  refresh();
  return {
    ok:
      before?.status !== "pending" && after?.status === "pending"
        ? t.actions.replay.backToReview
        : t.actions.replay.saved,
  };
}

export async function deleteMyReplay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionMessages();
  const parsed = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t.actions.invalidData };
  const supabase = await createClient();
  const { data, error } = await supabase.from("replays").delete().eq("id", parsed.data.id).select("id");
  if (error || !data?.length) return { error: t.actions.replay.deleteFailed };
  updateTag(REPLAYS_TAG);
  refresh();
  return { ok: t.actions.replay.deleted };
}

// -----------------------------------------------------------------------------
// Me gusta y comentarios (se llaman desde el feed, sin formulario)
// -----------------------------------------------------------------------------

export async function toggleReplayLike(replayId: string): Promise<{ liked: boolean } | { error: string }> {
  const t = await getActionMessages();
  if (!z.uuid().safeParse(replayId).success) return { error: t.actions.invalidData };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_replay_like", { p_replay: replayId });
  if (error) return { error: viewerError(t, error.message, t.actions.replays) };
  updateTag(REPLAYS_TAG);
  return { liked: Boolean(data) };
}

export async function loadReplayComments(replayId: string): Promise<ReplayComment[]> {
  if (!z.uuid().safeParse(replayId).success) return [];
  return getReplayComments(replayId);
}

export async function addReplayComment(replayId: string, body: string): Promise<{ ok: true } | { error: string }> {
  const t = await getActionMessages();
  if (!z.uuid().safeParse(replayId).success) return { error: t.actions.invalidData };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_replay_comment", { p_replay: replayId, p_body: body });
  if (error) return { error: viewerError(t, error.message, t.actions.replays) };
  updateTag(REPLAYS_TAG);
  return { ok: true };
}

export async function deleteReplayComment(commentId: string): Promise<{ ok: true } | { error: string }> {
  const t = await getActionMessages();
  if (!z.uuid().safeParse(commentId).success) return { error: t.actions.invalidData };
  const supabase = await createClient();
  const { data, error } = await supabase.from("replay_comments").delete().eq("id", commentId).select("id");
  if (error || !data?.length) return { error: t.actions.replay.commentDeleteFailed };
  updateTag(REPLAYS_TAG);
  return { ok: true };
}
