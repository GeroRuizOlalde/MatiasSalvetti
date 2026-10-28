"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { CUARTEL_TAG } from "@/lib/cuartel";
import { argentinaDateTime, checkbox, friendlyError } from "@/lib/panel-forms";
import { REWARD_KINDS } from "@/lib/rewards";
import { SETTINGS_TAG } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { hasFile, uploadPublicImage } from "@/lib/uploads";

const ERRORS: Record<string, string> = {
  forbidden: "Solo el admin maneja puntos y tienda.",
  order_not_pending: "Ese canje ya se resolvió.",
  note_required: "Poné un motivo para el ajuste.",
  missions_check: "Revisá la misión: las de link necesitan una URL y la fecha de fin va después de la de inicio.",
  shop_items_check: "Los premios de tickets necesitan la cantidad de tickets.",
};

const friendly = (message: string | undefined, fallback = "No se pudo guardar. Probá de nuevo.") =>
  friendlyError(ERRORS, message, fallback);

function invalidate() {
  updateTag(CUARTEL_TAG);
  refresh();
}

const int = (min: number, max: number, message: string) =>
  z.coerce.number({ error: message }).int(message).min(min, message).max(max, message);
const optionalInt = (min: number, message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return n;
    });
const optionalDate = z
  .union([argentinaDateTime("Fecha inválida."), z.literal("")])
  .optional()
  .transform((v) => v || null);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

// -----------------------------------------------------------------------------
// Premios automáticos
// -----------------------------------------------------------------------------

export async function saveRewards(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const amount = int(0, 100000, "Los premios tienen que ser números enteros entre 0 y 100.000.");
  const value: Record<string, { points: number; xp: number }> = {};
  for (const { key } of REWARD_KINDS) {
    const points = amount.safeParse(formData.get(`${key}_points`));
    const xp = amount.safeParse(formData.get(`${key}_xp`));
    if (!points.success || !xp.success)
      return { error: "Los premios tienen que ser números enteros entre 0 y 100.000." };
    value[key] = { points: points.data, xp: xp.data };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert({ key: "rewards", value, is_public: true });
  if (error) return { error: friendly(error.message) };
  updateTag(SETTINGS_TAG);
  refresh();
  return { ok: "Premios actualizados. Valen para lo que pase de ahora en más." };
}

// -----------------------------------------------------------------------------
// Misiones
// -----------------------------------------------------------------------------

const missionSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Poné un título.").max(80),
  description: optionalText(300),
  type: z.enum(["daily", "code", "link"]),
  points: int(0, 100000, "Los puntos van de 0 a 100.000."),
  xp: int(0, 100000, "La XP va de 0 a 100.000."),
  url: z
    .union([z.url({ protocol: /^https$/, error: "El link tiene que empezar con https://" }), z.literal("")])
    .optional()
    .transform((v) => v || null),
  code: optionalText(40),
  starts_at: optionalDate,
  ends_at: optionalDate,
  is_active: checkbox,
  sort_order: int(0, 999, "El orden va de 0 a 999."),
});

export async function saveMission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const parsed = missionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { id, code, ...values } = parsed.data;
  if (values.type === "code" && !code && !id) return { error: "Poné la palabra secreta." };
  if (values.type === "link" && !values.url) return { error: "Poné el link de la misión." };

  const supabase = await createClient();
  const result = id
    ? await supabase.from("missions").update(values).eq("id", id).select("id").single()
    : await supabase.from("missions").insert(values).select("id").single();
  if (result.error) return { error: friendly(result.error.message) };

  if (values.type === "code" && code) {
    const { error } = await supabase.from("mission_codes").upsert({ mission_id: result.data.id, code });
    if (error) return { error: "Misión guardada, pero no se pudo guardar la palabra." };
  }
  invalidate();
  return { ok: id ? "Misión actualizada." : "Misión creada." };
}

// -----------------------------------------------------------------------------
// Tienda
// -----------------------------------------------------------------------------

const itemSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Poné un nombre.").max(80),
  description: optionalText(500),
  kind: z.enum(["reward", "tickets"]),
  tickets: optionalInt(1, "Los tickets tienen que ser un número entero mayor a 0."),
  cost: int(1, 10_000_000, "El costo tiene que ser un número entero mayor a 0."),
  stock: optionalInt(0, "El stock tiene que ser un número entero."),
  per_user_limit: optionalInt(1, "El límite por persona tiene que ser mayor a 0."),
  min_level: int(1, 1000, "El nivel mínimo va de 1 a 1.000."),
  is_active: checkbox,
  sort_order: int(0, 999, "El orden va de 0 a 999."),
  remove_image: checkbox,
});

export async function saveShopItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { id, remove_image, ...values } = parsed.data;
  if (values.kind === "tickets" && !values.tickets) return { error: "Poné cuántos tickets da." };
  if (values.kind === "reward") values.tickets = null;

  const supabase = await createClient();
  const result = id
    ? await supabase.from("shop_items").update(values).eq("id", id).select("id").single()
    : await supabase.from("shop_items").insert(values).select("id").single();
  if (result.error) return { error: friendly(result.error.message) };

  const image = formData.get("image");
  if (hasFile(image)) {
    const upload = await uploadPublicImage(supabase, "shop", result.data.id, image);
    if ("error" in upload) return { error: `Premio guardado, pero ${upload.error.toLowerCase()}` };
    await supabase.from("shop_items").update({ image_path: upload.path }).eq("id", result.data.id);
  } else if (remove_image) {
    await supabase.from("shop_items").update({ image_path: null }).eq("id", result.data.id);
  }
  invalidate();
  return { ok: id ? "Premio actualizado." : "Premio agregado a la tienda." };
}

const orderSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["deliver", "cancel"]),
  note: z.string().trim().max(300).optional(),
});

export async function handleOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const parsed = orderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("handle_shop_order", {
    p_order: parsed.data.id,
    p_deliver: parsed.data.decision === "deliver",
    p_note: parsed.data.note ?? null,
  });
  if (error) return { error: friendly(error.message) };
  invalidate();
  return { ok: parsed.data.decision === "deliver" ? "Marcado como entregado." : "Canje cancelado y puntos devueltos." };
}

// -----------------------------------------------------------------------------
// Ajuste manual
// -----------------------------------------------------------------------------

const adjustSchema = z.object({
  login: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Poné el usuario de Twitch.")
    .transform((v) => v.replace(/^@/, "")),
  points: z.coerce
    .number({ error: "Poné los puntos (puede ser 0 o negativo)." })
    .int()
    .min(-10_000_000)
    .max(10_000_000),
  xp: z.coerce.number({ error: "La XP tiene que ser un número." }).int().min(0).max(10_000_000),
  note: z.string().trim().min(1, "Poné un motivo.").max(200),
});

export async function adjustPoints(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const parsed = adjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { login, points, xp, note } = parsed.data;
  if (points === 0 && xp === 0) return { error: "Poné puntos o XP para ajustar." };

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("twitch_login", login)
    .maybeSingle();
  if (!user) return { error: `No encontramos a "${login}". Tiene que haber entrado al menos una vez a la web.` };

  const { error } = await supabase.rpc("admin_adjust_points", {
    p_user: user.id,
    p_points: points,
    p_xp: xp,
    p_note: note,
  });
  if (error) return { error: friendly(error.message) };
  invalidate();
  return { ok: `Listo: ${points >= 0 ? "+" : ""}${points} puntos y +${xp} XP para ${user.display_name || login}.` };
}
