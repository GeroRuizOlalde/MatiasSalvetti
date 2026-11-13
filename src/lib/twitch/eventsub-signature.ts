import { createHmac, timingSafeEqual } from "node:crypto";

/** Twitch reintenta: un mensaje con más de 10 minutos se rechaza. */
export const EVENTSUB_MAX_AGE_MS = 10 * 60 * 1000;

export type EventSubHeaders = { id: string | null; timestamp: string | null; signature: string | null };

/** Firma esperada: HMAC-SHA256 de id + timestamp + cuerpo crudo. */
export function signEventSub(secret: string, id: string, timestamp: string, rawBody: string) {
  return `sha256=${createHmac("sha256", secret)
    .update(id + timestamp + rawBody)
    .digest("hex")}`;
}

/**
 * Verifica un mensaje de EventSub: que traiga los headers, que no sea viejo (ni del futuro)
 * y que la firma coincida. `rawBody` tiene que ser el cuerpo tal cual llegó, sin parsear.
 */
export function verifyEventSub(
  secret: string,
  headers: EventSubHeaders,
  rawBody: string,
  now: number = Date.now(),
): { ok: true } | { ok: false; reason: "missing" | "stale" | "signature" } {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing" };

  const sentAt = Date.parse(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > EVENTSUB_MAX_AGE_MS) return { ok: false, reason: "stale" };

  const expected = Buffer.from(signEventSub(secret, id, timestamp, rawBody));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false, reason: "signature" };
  }
  return { ok: true };
}
