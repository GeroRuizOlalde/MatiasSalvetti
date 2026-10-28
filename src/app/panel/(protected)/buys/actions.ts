"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { BUYS_TAG, buySessionTag } from "@/lib/buys";
import { checkbox, friendlyError, optionalAmount, optionalUuid, positiveAmount, resolveSlot } from "@/lib/panel-forms";
import { createClient } from "@/lib/supabase/server";

const ERRORS: Record<string, string> = {
  session_finished: "La sesión está terminada. Pasala a «En vivo» para corregir algo.",
  call_not_pending: "Ese call ya se revisó.",
  invalid_amount: "Revisá la apuesta y el costo.",
  forbidden: "No tenés permisos para esto.",
};

const friendly = (message: string | undefined, fallback = "No se pudo guardar. Probá de nuevo.") =>
  friendlyError(ERRORS, message, fallback);

function invalidate(sessionId: string) {
  updateTag(BUYS_TAG);
  updateTag(buySessionTag(sessionId));
  refresh();
}

// -----------------------------------------------------------------------------
// Sesiones
// -----------------------------------------------------------------------------

const sessionSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Poné un título.").max(80),
  casino_id: optionalUuid,
  currency: z.enum(["ARS", "USD"]),
  status: z.enum(["draft", "live", "finished"]).default("draft"),
  calls_open: checkbox,
});

export async function saveBuySession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePanelProfile("mod");
  const parsed = sessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { id, calls_open, ...values } = parsed.data;

  const supabase = await createClient();
  if (id) {
    // Al terminar la sesión se cierran los calls.
    const callsOpen = values.status === "finished" ? false : calls_open;
    const { error } = await supabase
      .from("buy_sessions")
      .update({ ...values, calls_open: callsOpen })
      .eq("id", id);
    if (error) return { error: friendly(error.message) };
    invalidate(id);
    return { ok: "Sesión actualizada." };
  }

  const { data, error } = await supabase
    .from("buy_sessions")
    .insert({ ...values, created_by: profile.id })
    .select("id")
    .single();
  if (error) return { error: friendly(error.message) };
  invalidate(data.id);
  redirect(`/panel/buys/${data.id}`);
}

export async function deleteBuySession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("buy_sessions").delete().eq("id", parsed.data.id).select("id");
  if (error) return { error: friendly(error.message, "No se pudo borrar.") };
  if (!data?.length) return { error: "Solo el admin puede borrar una sesión que ya se publicó." };
  updateTag(BUYS_TAG);
  updateTag(buySessionTag(parsed.data.id));
  redirect("/panel/buys");
}

// -----------------------------------------------------------------------------
// Compras
// -----------------------------------------------------------------------------

const optionalPayout = optionalAmount("El pago tiene que ser un número mayor o igual a 0.");

const buySchema = z.object({
  session_id: z.uuid(),
  slot_id: optionalUuid,
  slot_name: z.string().trim().min(1, "Elegí o escribí el slot.").max(120),
  bet: positiveAmount("la apuesta"),
  cost: positiveAmount("el costo"),
  payout: optionalPayout,
});

export async function addBuy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePanelProfile("mod");
  const parsed = buySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { session_id, bet, cost, payout } = parsed.data;

  const supabase = await createClient();
  const slot = await resolveSlot(supabase, {
    slotId: parsed.data.slot_id,
    slotName: parsed.data.slot_name,
    userId: profile.id,
  });
  if (!slot) return { error: "No se pudo agregar el slot al catálogo." };

  const { error } = await supabase
    .from("buys")
    .insert({ session_id, slot_id: slot.id, slot_name: slot.name, provider: slot.provider, bet, cost, payout });
  if (error) return { error: friendly(error.message) };
  invalidate(session_id);
  return { ok: `${slot.name} agregado.` };
}

const buyUpdateSchema = z.object({
  id: z.uuid(),
  session_id: z.uuid(),
  bet: positiveAmount("la apuesta"),
  cost: positiveAmount("el costo"),
  payout: optionalPayout,
});

export async function updateBuy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = buyUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { id, session_id, ...values } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("buys").update(values).eq("id", id).eq("session_id", session_id);
  if (error) return { error: friendly(error.message) };
  invalidate(session_id);
  return { ok: "Guardado." };
}

export async function deleteBuy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = z.object({ id: z.uuid(), session_id: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("buys")
    .delete()
    .eq("id", parsed.data.id)
    .eq("session_id", parsed.data.session_id);
  if (error) return { error: friendly(error.message, "No se pudo borrar.") };
  invalidate(parsed.data.session_id);
  return { ok: "Compra borrada." };
}

// -----------------------------------------------------------------------------
// Calls de viewers
// -----------------------------------------------------------------------------

const callSchema = z.object({
  id: z.uuid(),
  session_id: z.uuid(),
  decision: z.enum(["accept", "reject"]),
  bet: z.string().optional(),
  cost: z.string().optional(),
});

/** Acepta el call (se vuelve una compra del viewer, con apuesta y costo) o lo rechaza. */
export async function reviewBuyCall(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = callSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };
  const { id, session_id, decision } = parsed.data;

  const supabase = await createClient();
  if (decision === "reject") {
    const { error } = await supabase.rpc("reject_buy_call", { p_call: id });
    if (error) return { error: friendly(error.message) };
    refresh();
    return { ok: "Call rechazado." };
  }

  const bet = Number(parsed.data.bet);
  const cost = Number(parsed.data.cost);
  if (!(bet > 0) || !(cost > 0)) return { error: "Poné la apuesta y el costo para aceptar el call." };
  const { error } = await supabase.rpc("accept_buy_call", { p_call: id, p_bet: bet, p_cost: cost });
  if (error) return { error: friendly(error.message) };
  invalidate(session_id);
  return { ok: "Call aceptado." };
}
