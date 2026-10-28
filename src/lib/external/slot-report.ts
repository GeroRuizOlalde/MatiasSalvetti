import "server-only";
import { z } from "zod";

// slot.report: base pública de slots (https://slot.report/api/). Se usa solo
// para cargar nombres y proveedores en el catálogo; las imágenes no se toman
// de acá. Su uso pide un link a slot.report, que está en el pie de la web.

export const SLOT_REPORT_URL = "https://slot.report";
const SLOTS_ENDPOINT = `${SLOT_REPORT_URL}/api/v1/slots.json`;

export type SlotReportSlot = { name: string; provider: string | null };

const slotSchema = z.object({
  name: z.string(),
  // Algunas versiones de la API mandan el proveedor como texto y otras como objeto.
  provider: z.union([z.string(), z.object({ name: z.string() }).transform((p) => p.name)]).nullish(),
  provider_name: z.string().nullish(),
});

/** Acepta la lista sola o envuelta en { slots | data | items }. */
export function parseSlotReport(payload: unknown): SlotReportSlot[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? (["slots", "data", "items"].map((k) => (payload as Record<string, unknown>)[k]).find(Array.isArray) ?? [])
      : [];

  const seen = new Set<string>();
  const slots: SlotReportSlot[] = [];
  for (const item of list) {
    const parsed = slotSchema.safeParse(item);
    if (!parsed.success) continue;
    const name = parsed.data.name.trim().slice(0, 120);
    const provider = (parsed.data.provider ?? parsed.data.provider_name ?? "").trim().slice(0, 80) || null;
    const key = `${name.toLowerCase()}|${(provider ?? "").toLowerCase()}`;
    if (!name || seen.has(key)) continue;
    seen.add(key);
    slots.push({ name, provider });
  }
  return slots;
}

export async function fetchSlotReportSlots(): Promise<SlotReportSlot[]> {
  const res = await fetch(SLOTS_ENDPOINT, {
    headers: { Accept: "application/json", "User-Agent": "chupetti-web (catálogo de slots)" },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`slot.report respondió ${res.status}`);
  return parseSlotReport(await res.json());
}
