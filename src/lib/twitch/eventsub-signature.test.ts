import { describe, expect, it } from "vitest";
import { signEventSub, verifyEventSub } from "./eventsub-signature";

const SECRET = "un-secreto-de-prueba";
const NOW = Date.parse("2026-11-13T12:00:00Z");
const body = JSON.stringify({ subscription: { type: "channel.follow" }, event: { user_id: "1" } });

const headers = (overrides: Partial<{ id: string; timestamp: string; signature: string }> = {}) => {
  const id = overrides.id ?? "msg-1";
  const timestamp = overrides.timestamp ?? "2026-11-13T11:59:30Z";
  return { id, timestamp, signature: overrides.signature ?? signEventSub(SECRET, id, timestamp, body) };
};

describe("firma de EventSub", () => {
  it("acepta un mensaje bien firmado y reciente", () => {
    expect(verifyEventSub(SECRET, headers(), body, NOW)).toEqual({ ok: true });
  });

  it("rechaza si cambió el cuerpo, el id o el secreto", () => {
    expect(verifyEventSub(SECRET, headers(), body.replace('"1"', '"2"'), NOW)).toEqual({
      ok: false,
      reason: "signature",
    });
    const signed = headers();
    expect(verifyEventSub(SECRET, { ...signed, id: "msg-2" }, body, NOW)).toEqual({ ok: false, reason: "signature" });
    expect(verifyEventSub("otro-secreto", headers(), body, NOW)).toEqual({ ok: false, reason: "signature" });
    expect(verifyEventSub(SECRET, headers({ signature: "sha256=abc" }), body, NOW)).toEqual({
      ok: false,
      reason: "signature",
    });
  });

  it("rechaza mensajes con más de 10 minutos, aunque estén bien firmados", () => {
    expect(verifyEventSub(SECRET, headers({ timestamp: "2026-11-13T11:49:59Z" }), body, NOW)).toEqual({
      ok: false,
      reason: "stale",
    });
    expect(verifyEventSub(SECRET, headers({ timestamp: "2026-11-13T11:50:01Z" }), body, NOW)).toEqual({ ok: true });
    expect(verifyEventSub(SECRET, headers({ timestamp: "no-es-fecha" }), body, NOW)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("rechaza si falta algún header", () => {
    expect(verifyEventSub(SECRET, { id: null, timestamp: null, signature: null }, body, NOW)).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(verifyEventSub(SECRET, { ...headers(), signature: null }, body, NOW)).toEqual({
      ok: false,
      reason: "missing",
    });
  });
});
