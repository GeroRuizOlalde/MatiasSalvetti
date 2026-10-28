"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { HUNTS_TAG, huntTag } from "@/lib/hunts";
import { checkbox, friendlyError, optionalAmount, optionalUuid, positiveAmount, resolveSlot } from "@/lib/panel-forms";
import { createClient } from "@/lib/supabase/server";

const ERRORS: Record<string, string> = {
  hunt_finished: "El hunt está terminado. Pasalo a «Abriendo» para corregir algo.",
  bonuses_pending: "Faltan abrir bonos: cargá el pago de todos antes de terminar.",
  hunt_without_bonuses: "Cargá al menos un bono antes de terminar el hunt.",
  call_not_pending: "Ese call ya se revisó.",
  invalid_amount: "Revisá el monto.",
  forbidden: "No tenés permisos para esto.",
};

const friendly = (message: string | undefined, fallback = "No se pudo guardar. Probá de nuevo.") =>
  friendlyError(ERRORS, message, fallback);

function invalidate(huntId: string) {
  updateTag(HUNTS_TAG);
  updateTag(huntTag(huntId));
  refresh();
}

const money = (message: string) => z.coerce.number({ error: message }).min(0, message).max(999_999_999_999, message);
const optionalMoney = optionalAmount("El pago tiene que ser un número mayor o igual a 0.");

// -----------------------------------------------------------------------------
// Hunts
// -----------------------------------------------------------------------------

const huntSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Poné un título.").max(80),
  casino_id: optionalUuid,
  currency: z.enum(["ARS", "USD"]),
  start_cost: money("La inversión tiene que ser un número mayor o igual a 0."),
  status: z.enum(["draft", "collecting", "opening", "finished"]).default("draft"),
  calls_open: checkbox,
  guesses_open: checkbox,
});

export async function saveHunt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePanelProfile("mod");
  const parsed = huntSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { id, ...values } = parsed.data;
  // Terminado cierra calls y GTB; la base lo exige.
  if (values.status === "finished") Object.assign(values, { calls_open: false, guesses_open: false });

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("hunts").update(values).eq("id", id);
    if (error) return { error: friendly(error.message) };
    invalidate(id);
    return { ok: values.status === "finished" ? "Hunt terminado. Ya están los resultados." : "Hunt actualizado." };
  }

  const { data, error } = await supabase
    .from("hunts")
    .insert({ ...values, created_by: profile.id })
    .select("id")
    .single();
  if (error) return { error: friendly(error.message) };
  invalidate(data.id);
  redirect(`/panel/hunts/${data.id}`);
}

const idSchema = z.object({ id: z.uuid() });

export async function deleteHunt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("hunts").delete().eq("id", parsed.data.id).select("id");
  if (error) return { error: friendly(error.message, "No se pudo borrar.") };
  // Sin filas: RLS no lo dejó (un mod solo borra borradores).
  if (!data?.length) return { error: "Solo el admin puede borrar un hunt que ya se publicó." };
  updateTag(HUNTS_TAG);
  updateTag(huntTag(parsed.data.id));
  redirect("/panel/hunts");
}

// -----------------------------------------------------------------------------
// Bonos
// -----------------------------------------------------------------------------

const bonusSchema = z.object({
  hunt_id: z.uuid(),
  slot_id: optionalUuid,
  slot_name: z.string().trim().min(1, "Elegí o escribí el slot.").max(120),
  bet: positiveAmount("la apuesta"),
  payout: optionalMoney,
});

export async function addBonus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePanelProfile("mod");
  const parsed = bonusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { hunt_id, bet, payout } = parsed.data;

  const supabase = await createClient();
  const slot = await resolveSlot(supabase, {
    slotId: parsed.data.slot_id,
    slotName: parsed.data.slot_name,
    userId: profile.id,
  });
  if (!slot) return { error: "No se pudo agregar el slot al catálogo." };

  const { error } = await supabase
    .from("hunt_bonuses")
    .insert({ hunt_id, slot_id: slot.id, slot_name: slot.name, provider: slot.provider, bet, payout });
  if (error) return { error: friendly(error.message) };
  invalidate(hunt_id);
  return { ok: `${slot.name} agregado.` };
}

const bonusUpdateSchema = z.object({
  id: z.uuid(),
  hunt_id: z.uuid(),
  bet: positiveAmount("la apuesta"),
  payout: optionalMoney,
});

export async function updateBonus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = bonusUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { id, hunt_id, bet, payout } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("hunt_bonuses").update({ bet, payout }).eq("id", id).eq("hunt_id", hunt_id);
  if (error) return { error: friendly(error.message) };
  invalidate(hunt_id);
  return { ok: "Guardado." };
}

const bonusDeleteSchema = z.object({ id: z.uuid(), hunt_id: z.uuid() });

export async function deleteBonus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = bonusDeleteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("hunt_bonuses")
    .delete()
    .eq("id", parsed.data.id)
    .eq("hunt_id", parsed.data.hunt_id);
  if (error) return { error: friendly(error.message, "No se pudo borrar.") };
  invalidate(parsed.data.hunt_id);
  return { ok: "Bono borrado." };
}

// -----------------------------------------------------------------------------
// Calls de viewers
// -----------------------------------------------------------------------------

const callSchema = z.object({
  id: z.uuid(),
  hunt_id: z.uuid(),
  decision: z.enum(["accept", "reject"]),
  bet: z.string().optional(),
});

export async function reviewCall(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = callSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };
  const { id, hunt_id, decision } = parsed.data;

  const supabase = await createClient();
  if (decision === "reject") {
    const { error } = await supabase.rpc("reject_hunt_call", { p_call: id });
    if (error) return { error: friendly(error.message) };
    refresh();
    return { ok: "Call rechazado." };
  }

  const bet = Number(parsed.data.bet);
  if (!Number.isFinite(bet) || bet <= 0) return { error: "Poné la apuesta para aceptar el call." };
  const { error } = await supabase.rpc("accept_hunt_call", { p_call: id, p_bet: bet });
  if (error) return { error: friendly(error.message) };
  invalidate(hunt_id);
  return { ok: "Call aceptado." };
}
