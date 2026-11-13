import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { EVENTSUB_TYPES, sameCondition } = await import("./channel");

describe("suscripciones de EventSub", () => {
  it("una suscripción de otro canal no cuenta como la del canal conectado", () => {
    const follow = EVENTSUB_TYPES.find((t) => t.type === "channel.follow")!;
    const chupetti = follow.condition("111");
    expect(sameCondition({ broadcaster_user_id: "111", moderator_user_id: "111" }, chupetti)).toBe(true);
    expect(sameCondition({ broadcaster_user_id: "222", moderator_user_id: "222" }, chupetti)).toBe(false);
    expect(sameCondition({ broadcaster_user_id: "111", moderator_user_id: null }, chupetti)).toBe(false);
  });

  it("el raid se escucha hacia el canal, no desde el canal", () => {
    const raid = EVENTSUB_TYPES.find((t) => t.type === "channel.raid")!;
    expect(raid.condition("111")).toEqual({ to_broadcaster_user_id: "111" });
  });
});
