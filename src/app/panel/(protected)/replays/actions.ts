"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { friendlyError } from "@/lib/panel-forms";
import { normalizeDomain } from "@/lib/replay-providers";
import { REPLAYS_TAG } from "@/lib/replays";
import { createClient } from "@/lib/supabase/server";

function invalidate() {
  updateTag(REPLAYS_TAG);
  refresh();
}

// -----------------------------------------------------------------------------
// Replays
// -----------------------------------------------------------------------------

const reviewSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approve", "reject", "delete"]),
  reason: z.string().trim().max(200).optional(),
});

export async function reviewReplay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };
  const { id, decision, reason } = parsed.data;

  const supabase = await createClient();
  if (decision === "delete") {
    const { error } = await supabase.from("replays").delete().eq("id", id);
    if (error) return { error: "No se pudo borrar." };
    invalidate();
    return { ok: "Replay borrado." };
  }

  const { error } = await supabase.rpc("review_replay", {
    p_id: id,
    p_approve: decision === "approve",
    p_reason: reason || null,
  });
  if (error)
    return {
      error: friendlyError({ forbidden: "No tenés permisos para esto." }, error.message, "No se pudo guardar."),
    };
  invalidate();
  return { ok: decision === "approve" ? "Replay publicado." : "Replay rechazado." };
}

// -----------------------------------------------------------------------------
// Proveedores
// -----------------------------------------------------------------------------

const providerSchema = z.object({
  name: z.string().trim().min(1, "Poné el nombre del proveedor.").max(60),
  domain: z.string().trim().min(1, "Poné el dominio de los links."),
});

export async function addProvider(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = providerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const domain = normalizeDomain(parsed.data.domain);
  if (!domain) return { error: "El dominio no es válido. Ej.: nolimitcity.com o un link de replay entero." };

  const supabase = await createClient();
  const { error } = await supabase.from("replay_providers").insert({ name: parsed.data.name, domain });
  if (error) {
    return { error: error.code === "23505" ? "Ese dominio ya está cargado." : "No se pudo guardar el proveedor." };
  }
  invalidate();
  return { ok: `${parsed.data.name} agregado.` };
}

const providerIdSchema = z.object({ id: z.uuid(), action: z.enum(["embed_on", "embed_off", "delete"]) });

export async function updateProvider(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = providerIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };
  const { id, action } = parsed.data;

  const supabase = await createClient();
  const { error } =
    action === "delete"
      ? await supabase.from("replay_providers").delete().eq("id", id)
      : await supabase
          .from("replay_providers")
          .update({ embeddable: action === "embed_on" })
          .eq("id", id);
  if (error) return { error: "No se pudo guardar." };
  invalidate();
  return { ok: action === "delete" ? "Proveedor borrado." : "Guardado." };
}
