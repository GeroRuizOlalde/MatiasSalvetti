"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseAmount, parseAmountList } from "@/lib/amounts";
import { requirePanelProfile } from "@/lib/auth/session";
import { parseCsv } from "@/lib/csv";
import { argentinaDateTime, friendlyError } from "@/lib/panel-forms";
import { createClient } from "@/lib/supabase/server";
import { hasFile } from "@/lib/uploads";
import { WAGER_TAG } from "@/lib/wager";

const ERRORS: Record<string, string> = {
  forbidden: "Solo el admin maneja la Wager Race.",
  wager_races_check: "La fecha de fin tiene que ser posterior a la de inicio.",
  invalid_rows: "El archivo tiene demasiadas filas (máximo 20.000).",
};

const friendly = (message: string | undefined, fallback = "No se pudo guardar. Probá de nuevo.") =>
  friendlyError(ERRORS, message, fallback);

function invalidate() {
  updateTag(WAGER_TAG);
  refresh();
}

const raceSchema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(1, "Poné un título.").max(80),
    casino_id: z.uuid({ error: "Elegí el casino de la carrera." }),
    currency: z.enum(["ARS", "USD"]),
    starts_at: argentinaDateTime("Poné la fecha de inicio."),
    ends_at: argentinaDateTime("Poné la fecha de fin."),
    prizes: z
      .string()
      .optional()
      .transform((v, ctx) => {
        const list = parseAmountList(v ?? "");
        if (!list) {
          ctx.addIssue({ code: "custom", message: "Los premios tienen que ser montos, uno por renglón." });
          return z.NEVER;
        }
        if (list.length > 50) {
          ctx.addIssue({ code: "custom", message: "Máximo 50 premios." });
          return z.NEVER;
        }
        return list;
      }),
    rules_md: z
      .string()
      .trim()
      .max(5000)
      .optional()
      .transform((v) => v || null),
    status: z.enum(["draft", "published"]).default("draft"),
  })
  .refine((r) => r.ends_at > r.starts_at, { message: "La fecha de fin tiene que ser posterior a la de inicio." });

export async function saveRace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePanelProfile("admin");
  const parsed = raceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { id, ...values } = parsed.data;

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("wager_races").update(values).eq("id", id);
    if (error) return { error: friendly(error.message) };
    invalidate();
    return { ok: "Carrera actualizada." };
  }

  const { data, error } = await supabase
    .from("wager_races")
    .insert({ ...values, created_by: profile.id })
    .select("id")
    .single();
  if (error) return { error: friendly(error.message) };
  invalidate();
  redirect(`/panel/wager-race/${data.id}`);
}

export async function deleteRace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const parsed = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("wager_races").delete().eq("id", parsed.data.id);
  if (error) return { error: friendly(error.message, "No se pudo borrar.") };
  updateTag(WAGER_TAG);
  redirect("/panel/wager-race");
}

// -----------------------------------------------------------------------------
// Wager
// -----------------------------------------------------------------------------

export type ImportWagerState = ActionState & { unmatched?: string[] };

/** CSV del casino: primera columna el ID de cuenta, segunda el wager del período. */
export async function importWagers(_prev: ImportWagerState, formData: FormData): Promise<ImportWagerState> {
  await requirePanelProfile("admin");
  const raceId = z.uuid().safeParse(formData.get("race_id"));
  if (!raceId.success) return { error: "Datos inválidos." };
  const file = formData.get("file");
  if (!hasFile(file)) return { error: "Elegí el archivo CSV del casino." };
  if (file.size > 5 * 1024 * 1024) return { error: "El archivo no puede pesar más de 5 MB." };

  const rows = parseCsv(await file.text());
  // Encabezado: la primera fila cuya segunda columna no es un monto ("Player ID, Wager").
  if (rows.length && parseAmount(rows[0][1] ?? "") === null) rows.shift();

  const parsed = rows
    .map(([accountId = "", wager = ""]) => ({ account_id: accountId.trim(), wager: parseAmount(wager) }))
    .filter(
      (r): r is { account_id: string; wager: number } => Boolean(r.account_id) && r.wager !== null && r.wager >= 0,
    );
  if (parsed.length === 0) return { error: "No encontramos filas con ID y wager en el archivo." };
  const invalid = rows.length - parsed.length;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_wagers", {
    p_race: raceId.data,
    p_rows: parsed.map((r) => ({ account_id: r.account_id, wager: r.wager.toFixed(2) })),
  });
  if (error) return { error: friendly(error.message, "No se pudo importar el archivo.") };

  const result = z.object({ matched: z.number(), unmatched: z.array(z.string()) }).parse(data);
  invalidate();
  return {
    ok: `Actualizado el wager de ${result.matched} cuentas verificadas.${invalid ? ` ${invalid} filas no se pudieron leer.` : ""}`,
    unmatched: result.unmatched,
  };
}

const entrySchema = z.object({
  race_id: z.uuid(),
  account_id: z.uuid(),
  wager: z.string().transform((v, ctx) => {
    const n = parseAmount(v);
    if (n === null || n < 0) {
      ctx.addIssue({ code: "custom", message: "Revisá el monto." });
      return z.NEVER;
    }
    return n;
  }),
});

export async function updateEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePanelProfile("admin");
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { race_id, account_id, wager } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("wager_entries")
    .update({ wager })
    .eq("race_id", race_id)
    .eq("account_id", account_id);
  if (error) return { error: friendly(error.message) };
  invalidate();
  return { ok: "Guardado." };
}
