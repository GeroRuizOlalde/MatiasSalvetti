import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database";

// Piezas de validación y helpers compartidos por las Server Actions de las sesiones (hunts, buys, battles).

export const checkbox = z
  .literal("on")
  .optional()
  .transform((v) => v === "on");

export const optionalUuid = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((v) => v || null);

export const positiveAmount = (label: string) =>
  z.coerce
    .number({ error: `Poné ${label}.` })
    .gt(0, `${label[0].toUpperCase()}${label.slice(1)} tiene que ser mayor a 0.`)
    .max(999_999_999);

/** Monto opcional (vacío = null), mayor o igual a 0. */
export const optionalAmount = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 999_999_999_999) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return n;
    });

/** Traduce los `raise exception '<código>'` de la base a mensajes para el panel. */
export function friendlyError(errors: Record<string, string>, message: string | undefined, fallback: string) {
  const key = Object.keys(errors).find((k) => message?.includes(k));
  return key ? errors[key] : fallback;
}

export type SlotRef = { id: string; name: string; provider: string | null };

/**
 * Slot elegido en el buscador (`slot_id`) o escrito a mano (`slot_name`). Si
 * se escribió a mano se busca en el catálogo por nombre y, si no está, se agrega.
 */
export async function resolveSlot(
  supabase: SupabaseClient<Database>,
  input: { slotId: string | null; slotName: string; userId: string },
): Promise<SlotRef | null> {
  if (input.slotId) {
    const { data } = await supabase.from("slots").select("id, name, provider").eq("id", input.slotId).maybeSingle();
    if (data) return data;
  }
  const name = input.slotName.trim();
  const { data: existing } = await supabase
    .from("slots")
    .select("id, name, provider")
    .ilike(
      "name",
      name.replace(/[\\%_]/g, (c) => `\\${c}`),
    )
    .limit(1)
    .maybeSingle();
  if (existing) return existing;
  const { data: created } = await supabase
    .from("slots")
    .insert({ name, created_by: input.userId })
    .select("id, name, provider")
    .single();
  return created;
}
