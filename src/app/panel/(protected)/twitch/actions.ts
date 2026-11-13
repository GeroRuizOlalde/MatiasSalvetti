"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { currentOrigin } from "@/lib/origin";
import { disconnectChannel, syncEventSubSubscriptions } from "@/lib/twitch/channel";

/** Crea las suscripciones que falten y actualiza el estado de todas. */
export async function syncEvents(): Promise<ActionState> {
  await requirePanelProfile("admin");
  const result = await syncEventSubSubscriptions(await currentOrigin());
  refresh();
  if (!result.ok) return { error: result.error };
  if (result.failed.length) {
    return {
      error: `Twitch rechazó ${result.failed.length} evento(s): ${result.failed.join(", ")}. Fijate el estado abajo.`,
    };
  }
  return { ok: result.created ? `Listo: se crearon ${result.created} suscripciones.` : "Todo al día." };
}

export async function disconnect(): Promise<ActionState> {
  await requirePanelProfile("admin");
  try {
    await disconnectChannel();
  } catch {
    return { error: "No se pudo desconectar. Probá de nuevo." };
  }
  refresh();
  return { ok: "Canal desconectado." };
}
