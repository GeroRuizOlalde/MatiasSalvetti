"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { BATTLES_TAG, battleTag } from "@/lib/battles";
import { friendlyError, optionalAmount, optionalUuid, resolveSlot } from "@/lib/panel-forms";
import { createClient } from "@/lib/supabase/server";

const ERRORS: Record<string, string> = {
  battle_started: "La battle ya arrancó: borrá el cuadro para cambiar los slots o la instancia.",
  invalid_entry_count: "Para arrancar tienen que estar todos los slots de la instancia elegida.",
  battle_full: "El cuadro ya está completo para la instancia elegida.",
  size_too_small: "Hay más slots cargados que los que entran en esa instancia.",
  call_not_pending: "Ese call ya se revisó.",
  invalid_status: "Ese cambio de estado no se puede hacer a mano.",
  next_match_started: "El cruce siguiente ya tiene resultados: borralos primero.",
  forbidden: "No tenés permisos para esto.",
};

const friendly = (message: string | undefined, fallback = "No se pudo guardar. Probá de nuevo.") =>
  friendlyError(ERRORS, message, fallback);

function invalidate(battleId: string) {
  updateTag(BATTLES_TAG);
  updateTag(battleTag(battleId));
  refresh();
}

const battleIdSchema = z.object({ battle_id: z.uuid() });

// -----------------------------------------------------------------------------
// Battles
// -----------------------------------------------------------------------------

const battleSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Poné un título.").max(80),
  casino_id: optionalUuid,
  currency: z.enum(["ARS", "USD"]),
  // live y finished los manejan start_battle y los resultados.
  status: z.enum(["draft", "open"]).optional(),
  // Instancia de arranque: cantidad de slots del cuadro.
  size: z.coerce
    .number()
    .refine((n) => [2, 4, 8, 16, 32, 64].includes(n), "Elegí desde qué instancia arranca.")
    .optional(),
});

export async function saveBattle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePanelProfile("mod");
  const parsed = battleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { id, ...values } = parsed.data;

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("battles").update(values).eq("id", id);
    if (error) return { error: friendly(error.message) };
    invalidate(id);
    return { ok: "Battle actualizada." };
  }

  const { data, error } = await supabase
    .from("battles")
    .insert({ ...values, status: "draft", created_by: profile.id })
    .select("id")
    .single();
  if (error) return { error: friendly(error.message) };
  invalidate(data.id);
  redirect(`/panel/battles/${data.id}`);
}

export async function deleteBattle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = battleIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("battles").delete().eq("id", parsed.data.battle_id).select("id");
  if (error) return { error: friendly(error.message, "No se pudo borrar.") };
  if (!data?.length) return { error: "Solo el admin puede borrar una battle que ya se publicó." };
  updateTag(BATTLES_TAG);
  updateTag(battleTag(parsed.data.battle_id));
  redirect("/panel/battles");
}

export async function startBattle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = battleIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_battle", { p_battle: parsed.data.battle_id });
  if (error) return { error: friendly(error.message) };
  invalidate(parsed.data.battle_id);
  return { ok: "¡Arrancó la battle! Ya está el cuadro." };
}

export async function resetBattle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = battleIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_battle", { p_battle: parsed.data.battle_id });
  if (error) return { error: friendly(error.message) };
  invalidate(parsed.data.battle_id);
  return { ok: "Cuadro borrado. La battle volvió a «Calls abiertos»." };
}

// -----------------------------------------------------------------------------
// Slots de la battle
// -----------------------------------------------------------------------------

const entrySchema = battleIdSchema.extend({
  slot_id: optionalUuid,
  slot_name: z.string().trim().min(1, "Elegí o escribí el slot.").max(120),
});

export async function addEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePanelProfile("mod");
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };

  const supabase = await createClient();
  const slot = await resolveSlot(supabase, {
    slotId: parsed.data.slot_id,
    slotName: parsed.data.slot_name,
    userId: profile.id,
  });
  if (!slot) return { error: "No se pudo agregar el slot al catálogo." };

  const { error } = await supabase
    .from("battle_entries")
    .insert({ battle_id: parsed.data.battle_id, slot_id: slot.id, slot_name: slot.name, provider: slot.provider });
  if (error) return { error: friendly(error.message) };
  invalidate(parsed.data.battle_id);
  return { ok: `${slot.name} agregado.` };
}

export async function deleteEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = battleIdSchema.extend({ id: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("battle_entries")
    .delete()
    .eq("id", parsed.data.id)
    .eq("battle_id", parsed.data.battle_id);
  if (error) return { error: friendly(error.message, "No se pudo borrar.") };
  invalidate(parsed.data.battle_id);
  return { ok: "Slot quitado." };
}

/** Sortea el orden de los slots (define los cruces de la primera ronda). */
export async function shuffleEntries(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = battleIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { data: entries } = await supabase.from("battle_entries").select("id").eq("battle_id", parsed.data.battle_id);
  const ids = (entries ?? []).map((e) => e.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const results = await Promise.all(
    ids.map((id, i) =>
      supabase
        .from("battle_entries")
        .update({ seed: i + 1 })
        .eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: friendly(failed.error.message) };
  invalidate(parsed.data.battle_id);
  return { ok: "Orden sorteado." };
}

// -----------------------------------------------------------------------------
// Resultados de los cruces
// -----------------------------------------------------------------------------

const optional = optionalAmount("Revisá los montos: tienen que ser números mayores o iguales a 0.");

const matchSchema = battleIdSchema.extend({
  id: z.uuid(),
  bet_a: optional,
  payout_a: optional,
  bet_b: optional,
  payout_b: optional,
});

export async function saveMatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = matchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { id, battle_id, ...values } = parsed.data;
  if (values.bet_a === 0 || values.bet_b === 0) return { error: "La apuesta tiene que ser mayor a 0." };

  const supabase = await createClient();
  const { error } = await supabase.from("battle_matches").update(values).eq("id", id).eq("battle_id", battle_id);
  if (error) return { error: friendly(error.message) };
  invalidate(battle_id);
  return { ok: "Guardado." };
}

// -----------------------------------------------------------------------------
// Calls de viewers
// -----------------------------------------------------------------------------

const callSchema = z.object({ id: z.uuid(), battle_id: z.uuid(), decision: z.enum(["accept", "reject"]) });

/** Acepta el call (el slot entra al cuadro a nombre del viewer) o lo rechaza. */
export async function reviewBattleCall(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("mod");
  const parsed = callSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };
  const { id, battle_id, decision } = parsed.data;

  const supabase = await createClient();
  const { error } =
    decision === "accept"
      ? await supabase.rpc("accept_battle_call", { p_call: id })
      : await supabase.rpc("reject_battle_call", { p_call: id });
  if (error) return { error: friendly(error.message) };
  invalidate(battle_id);
  return { ok: decision === "accept" ? "Call aceptado: el slot entró al cuadro." : "Call rechazado." };
}
