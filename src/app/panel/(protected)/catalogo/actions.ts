"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { CASINOS_TAG } from "@/lib/casinos";
import { parseCsv } from "@/lib/csv";
import { fetchSlotReportSlots } from "@/lib/external/slot-report";
import { createClient } from "@/lib/supabase/server";
import { hasFile, uploadPublicImage } from "@/lib/uploads";

const checkbox = z
  .literal("on")
  .optional()
  .transform((v) => v === "on");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

// -----------------------------------------------------------------------------
// Slots (mod y admin)
// -----------------------------------------------------------------------------

const slotSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Poné el nombre del slot.").max(120),
  provider: optionalText(80),
  is_active: checkbox,
  remove_image: checkbox,
});

export async function saveSlot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = slotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { id, name, provider, is_active, remove_image } = parsed.data;

  const supabase = await createClient();
  const values = { name, provider, is_active };
  const result = id
    ? await supabase.from("slots").update(values).eq("id", id).select("id").single()
    : await supabase.from("slots").insert(values).select("id").single();

  if (result.error) {
    return {
      error: result.error.code === "23505" ? "Ya existe un slot con ese nombre y proveedor." : "No se pudo guardar.",
    };
  }

  const image = formData.get("image");
  if (hasFile(image)) {
    const upload = await uploadPublicImage(supabase, "slots", result.data.id, image);
    if ("error" in upload) return { error: `Slot guardado, pero ${upload.error.toLowerCase()}` };
    await supabase.from("slots").update({ image_path: upload.path }).eq("id", result.data.id);
  } else if (remove_image) {
    await supabase.from("slots").update({ image_path: null }).eq("id", result.data.id);
  }

  refresh();
  return { ok: id ? "Slot actualizado." : `"${name}" agregado al catálogo.` };
}

const HEADER_WORDS = ["nombre", "name", "slot", "juego", "game"];

export async function importSlots(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const file = formData.get("file");
  if (!hasFile(file)) return { error: "Elegí un archivo CSV." };
  if (file.size > 2 * 1024 * 1024) return { error: "El archivo no puede pesar más de 2 MB." };

  const rows = parseCsv(await file.text());
  if (rows.length && HEADER_WORDS.includes(rows[0][0]?.trim().toLowerCase() ?? "")) rows.shift();
  const slots = rows.map(([name = "", provider = ""]) => ({ name: name.trim(), provider: provider.trim() }));
  const valid = slots.filter((s) => s.name);
  if (valid.length === 0) return { error: "No encontramos slots en el archivo." };
  if (valid.length > 5000) return { error: "Máximo 5.000 slots por archivo. Dividilo en partes." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_slots", { p_rows: valid });
  if (error) return { error: "No se pudo importar el archivo." };

  refresh();
  const skipped = valid.length - (data ?? 0);
  return {
    ok: `Importados ${data ?? 0} slots nuevos${skipped ? ` (${skipped} ya existían o estaban repetidos)` : ""}.`,
  };
}

/** Trae nombres y proveedores de slot.report. Se puede repetir: los que ya están se saltean. */
export async function importFromSlotReport(): Promise<ActionState> {
  await requirePanelProfile("mod");

  let slots;
  try {
    slots = await fetchSlotReportSlots();
  } catch (error) {
    console.error("[catalogo] slot.report", error);
    return { error: "No pudimos conectarnos con slot.report. Probá de nuevo en un rato." };
  }
  if (slots.length === 0) return { error: "slot.report no devolvió slots. Puede que haya cambiado su formato." };

  const supabase = await createClient();
  let inserted = 0;
  // import_slots acepta hasta 5.000 filas por llamada.
  for (let i = 0; i < slots.length; i += 5000) {
    const { data, error } = await supabase.rpc("import_slots", { p_rows: slots.slice(i, i + 5000) });
    if (error) return { error: `Se importaron ${inserted} slots y después falló. Probá de nuevo para seguir.` };
    inserted += data ?? 0;
  }

  refresh();
  const skipped = slots.length - inserted;
  return { ok: `Importados ${inserted} slots nuevos de slot.report${skipped ? ` (${skipped} ya estaban)` : ""}.` };
}

// -----------------------------------------------------------------------------
// Casinos (solo admin)
// -----------------------------------------------------------------------------

const casinoSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Poné el nombre.").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "El identificador solo puede tener letras minúsculas, números y guiones."),
  referral_url: z.url({ protocol: /^https$/, error: "El link de referido tiene que empezar con https://" }),
  code: optionalText(40),
  sort_order: z.coerce.number().int().min(0).max(999),
  is_active: checkbox,
  remove_logo: checkbox,
});

export async function saveCasino(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const parsed = casinoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { id, remove_logo, ...values } = parsed.data;

  const supabase = await createClient();
  const result = id
    ? await supabase.from("casinos").update(values).eq("id", id).select("id, slug").single()
    : await supabase.from("casinos").insert(values).select("id, slug").single();
  if (result.error) {
    return { error: result.error.code === "23505" ? "Ya hay un casino con ese identificador." : "No se pudo guardar." };
  }

  const logo = formData.get("logo");
  if (hasFile(logo)) {
    const upload = await uploadPublicImage(supabase, "casinos", result.data.slug, logo);
    if ("error" in upload) return { error: `Casino guardado, pero ${upload.error.toLowerCase()}` };
    await supabase.from("casinos").update({ logo_path: upload.path }).eq("id", result.data.id);
  } else if (remove_logo) {
    await supabase.from("casinos").update({ logo_path: null }).eq("id", result.data.id);
  }

  updateTag(CASINOS_TAG);
  refresh();
  return { ok: id ? "Casino actualizado." : "Casino creado." };
}
