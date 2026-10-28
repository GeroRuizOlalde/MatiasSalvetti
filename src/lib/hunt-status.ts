import type { Enums } from "@/types/database";

export type HuntStatus = Enums<"hunt_status">;

export const HUNT_STATUSES: { value: HuntStatus; label: string; hint: string }[] = [
  { value: "draft", label: "Borrador", hint: "No se ve en la web." },
  { value: "collecting", label: "Juntando bonos", hint: "Se ve en la web. Se cargan bonos y calls." },
  { value: "opening", label: "Abriendo", hint: "Se abren los bonos en vivo." },
  { value: "finished", label: "Terminado", hint: "Calcula el balance final y el ganador del GTB." },
];

export const HUNT_STATUS_LABEL: Record<HuntStatus, string> = Object.fromEntries(
  HUNT_STATUSES.map((s) => [s.value, s.label]),
) as Record<HuntStatus, string>;

export function isHuntActive(status: HuntStatus) {
  return status === "collecting" || status === "opening";
}
