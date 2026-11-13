"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { getActionMessages } from "@/i18n/server";
import { formatInteger } from "@/lib/format";
import type { ActionState } from "@/lib/action-state";
import { CUARTEL_TAG } from "@/lib/cuartel";
import { createClient } from "@/lib/supabase/server";
import { viewerError } from "@/lib/viewer-actions";

export async function claimMission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionMessages();
  const parsed = z
    .object({
      mission_id: z.uuid(),
      code: z.string().trim().max(40).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t.actions.invalidData };

  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_mission", {
    p_mission: parsed.data.mission_id,
    p_code: parsed.data.code || null,
  });
  if (error) return { error: viewerError(t, error.message, t.actions.cuartel) };
  refresh();
  return { ok: t.actions.missionDone };
}

export async function buyItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionMessages();
  const item = z.uuid().safeParse(formData.get("item_id"));
  if (!item.success) return { error: t.actions.invalidData };

  const supabase = await createClient();
  const { error } = await supabase.rpc("buy_shop_item", { p_item: item.data });
  if (error) return { error: viewerError(t, error.message, t.actions.cuartel) };
  // El stock cambió para todos.
  updateTag(CUARTEL_TAG);
  refresh();
  return { ok: t.actions.redeemed };
}

/** Bonus diario: una vez por día (hora de Argentina), con racha. */
export async function claimDailyBonus(): Promise<ActionState> {
  const t = await getActionMessages();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_daily_bonus");
  if (error) return { error: viewerError(t, error.message, t.actions.cuartel) };
  const result = data?.[0];
  refresh();
  if (!result) return { ok: t.actions.missionDone };
  return {
    ok: t.actions.dailyClaimed(formatInteger(result.points), result.streak),
  };
}
