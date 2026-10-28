import type { Enums } from "@/types/database";

export type StatusTone = "muted" | "live" | "done" | "next";

type StatusInfo<T extends string> = { value: T; label: string; hint: string; tone: StatusTone };

export const BUY_STATUSES: StatusInfo<Enums<"buy_session_status">>[] = [
  { value: "draft", label: "Borrador", hint: "No se ve en la web.", tone: "muted" },
  { value: "live", label: "En vivo", hint: "Se ve en la web. Se cargan compras y votaciones.", tone: "live" },
  { value: "finished", label: "Terminada", hint: "Cierra la votación abierta y bloquea las compras.", tone: "done" },
];

export const BATTLE_STATUSES: StatusInfo<Enums<"battle_status">>[] = [
  { value: "draft", label: "Borrador", hint: "No se ve en la web.", tone: "muted" },
  { value: "open", label: "Bancá a tu slot", hint: "Se ve en la web y los viewers eligen su slot.", tone: "next" },
  { value: "live", label: "En juego", hint: "El cuadro está armado y se juegan los cruces.", tone: "live" },
  { value: "finished", label: "Terminada", hint: "Ya hay campeón.", tone: "done" },
];

export function statusInfo<T extends string>(list: StatusInfo<T>[], value: T) {
  return list.find((s) => s.value === value) ?? list[0];
}
