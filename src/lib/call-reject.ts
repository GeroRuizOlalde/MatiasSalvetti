/** Por qué el panel rechazó un call. Solo «no salió» deja al viewer sin otro pedido. */
export const CALL_REJECT_REASONS = [
  "not_triggered",
  "already_called",
  "unavailable",
] as const;

export type CallRejectReason = (typeof CALL_REJECT_REASONS)[number];

export type RetryReason = Exclude<CallRejectReason, "not_triggered">;

export function isCallRejectReason(value: unknown): value is CallRejectReason {
  return (
    typeof value === "string" &&
    (CALL_REJECT_REASONS as readonly string[]).includes(value)
  );
}

/** Rechazado porque ya estaba pedida o no estaba disponible: puede pedir otra máquina. */
export function retryReason(
  call: { status: string; reject_reason?: string | null } | null,
): RetryReason | null {
  if (call?.status !== "rejected") return null;
  return call.reject_reason === "already_called" ||
    call.reject_reason === "unavailable"
    ? call.reject_reason
    : null;
}
