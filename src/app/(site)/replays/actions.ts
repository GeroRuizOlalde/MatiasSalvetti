"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { REPLAYS_TAG } from "@/lib/replays";
import { createClient } from "@/lib/supabase/server";
import { viewerError } from "@/lib/viewer-actions";

const ERRORS: Record<string, string> = {
  invalid_url: "Pegá el link completo del replay (empieza con https://).",
  invalid_slot: "Elegí o escribí el slot.",
  invalid_multi: "Revisá el multi.",
  invalid_note: "El comentario es muy largo.",
  replay_duplicate: "Ese replay ya lo compartió alguien.",
  too_many_pending: "Tenés 5 replays esperando revisión. Esperá a que el panel los revise.",
};

const schema = z.object({
  url: z.string().trim().min(1, "Pegá el link del replay.").max(500, "El link es muy largo."),
  slot_id: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
  slot_name: z.string().trim().min(1, "Elegí o escribí el slot.").max(120),
  multi: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) {
        ctx.addIssue({ code: "custom", message: "El multi tiene que ser mayor a 0." });
        return z.NEVER;
      }
      return n;
    }),
  note: z.string().trim().max(200, "El comentario es muy largo.").optional(),
});

export async function submitReplay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { url, slot_id, slot_name, multi, note } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_replay", {
    p_url: url,
    p_slot: slot_id,
    p_slot_name: slot_name,
    p_multi: multi,
    p_note: note || null,
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
