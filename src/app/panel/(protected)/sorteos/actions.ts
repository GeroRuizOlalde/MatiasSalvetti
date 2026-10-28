"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { GIVEAWAYS_TAG } from "@/lib/giveaways";
import { argentinaDateTime, checkbox, friendlyError, optionalUuid } from "@/lib/panel-forms";
import { createClient } from "@/lib/supabase/server";
import { hasFile, uploadPublicImage } from "@/lib/uploads";

const ERRORS: Record<string, string> = {
  forbidden: "Solo el admin maneja los sorteos.",
  nothing_to_draw: "Ya están todos los ganadores. Anulá uno para volver a sortear.",
  no_entries: "No quedan participantes para sortear.",
  not_found: "El sorteo tiene que estar publicado.",
  giveaways_check: "La fecha de cierre tiene que ser posterior a la de apertura.",
};

const friendly = (message: string | undefined, fallback = "No se pudo guardar. Probá de nuevo.") =>
  friendlyError(ERRORS, message, fallback);

function invalidate() {
  updateTag(GIVEAWAYS_TAG);
  refresh();
}

const int = (min: number, max: number, message: string) =>
  z.coerce.number({ error: message }).int(message).min(min, message).max(max, message);

const schema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(1, "Poné un título.").max(80),
    prize: z.string().trim().min(1, "Poné el premio.").max(120),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => v || null),
    starts_at: argentinaDateTime("Poné la fecha de apertura."),
    ends_at: argentinaDateTime("Poné la fecha de cierre."),
    status: z.enum(["draft", "published"]),
    entry_mode: z.enum(["free", "tickets"]),
    max_tickets_per_user: int(1, 1000, "El máximo de tickets va de 1 a 1.000."),
    winners_count: int(1, 100, "Los ganadores van de 1 a 100."),
    min_level: int(1, 1000, "El nivel mínimo va de 1 a 1.000."),
    casino_id: optionalUuid,
    remove_image: checkbox,
  })
  .refine((g) => g.ends_at > g.starts_at, { message: "La fecha de cierre tiene que ser posterior a la de apertura." });

export async function saveGiveaway(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePanelProfile("admin");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { id, remove_image, ...values } = parsed.data;
  if (values.entry_mode === "free") values.max_tickets_per_user = 1;

  const supabase = await createClient();
  const result = id
    ? await supabase.from("giveaways").update(values).eq("id", id).select("id").single()
    : await supabase
        .from("giveaways")
        .insert({ ...values, created_by: profile.id })
        .select("id")
        .single();
  if (result.error) return { error: friendly(result.error.message) };

  const image = formData.get("image");
  if (hasFile(image)) {
    const upload = await uploadPublicImage(supabase, "giveaways", result.data.id, image);
    if ("error" in upload) return { error: `Sorteo guardado, pero ${upload.error.toLowerCase()}` };
    await supabase.from("giveaways").update({ image_path: upload.path }).eq("id", result.data.id);
  } else if (remove_image) {
    await supabase.from("giveaways").update({ image_path: null }).eq("id", result.data.id);
  }

  invalidate();
  if (!id) redirect(`/panel/sorteos/${result.data.id}`);
  return { ok: "Sorteo actualizado." };
}

export async function deleteGiveaway(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const parsed = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.from("giveaways").delete().eq("id", parsed.data.id);
  if (error) return { error: friendly(error.message, "No se pudo borrar.") };
  updateTag(GIVEAWAYS_TAG);
  redirect("/panel/sorteos");
}

export async function drawGiveaway(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const parsed = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("draw_giveaway", { p_giveaway: parsed.data.id });
  if (error) return { error: friendly(error.message, "No se pudo sortear.") };
  invalidate();
  return { ok: data === 1 ? "¡Hay ganador!" : `¡Hay ${data} ganadores!` };
}

const winnerSchema = z.object({
  giveaway_id: z.uuid(),
  user_id: z.uuid(),
  status: z.enum(["pending", "contacted", "delivered", "void"]),
});

export async function setWinnerStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const parsed = winnerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_winner_status", {
    p_giveaway: parsed.data.giveaway_id,
    p_user: parsed.data.user_id,
    p_status: parsed.data.status,
  });
  if (error) return { error: friendly(error.message) };
  invalidate();
  return { ok: parsed.data.status === "void" ? "Ganador anulado. Podés sortear otro." : "Guardado." };
}
