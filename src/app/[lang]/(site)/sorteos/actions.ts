"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { getActionMessages } from "@/i18n/server";
import type { ActionState } from "@/lib/action-state";
import { GIVEAWAYS_TAG } from "@/lib/giveaways";
import { createClient } from "@/lib/supabase/server";
import { viewerError } from "@/lib/viewer-actions";

export async function enterGiveaway(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionMessages();
  const parsed = z
    .object({ giveaway_id: z.uuid(), tickets: z.coerce.number().int().min(1).max(1000).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t.actions.checkTickets };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enter_giveaway", {
    p_giveaway: parsed.data.giveaway_id,
    p_tickets: parsed.data.tickets ?? 1,
  });
  if (error) return { error: viewerError(t, error.message, t.actions.giveaways) };
  updateTag(GIVEAWAYS_TAG);
  refresh();
  return { ok: data && data > 1 ? t.actions.enteredChances(data) : t.actions.entered };
}
