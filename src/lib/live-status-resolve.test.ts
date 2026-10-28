import { describe, expect, it } from "vitest";
import { resolveLiveStatus, type PlatformStream } from "./live-status-resolve";

const stream = (viewers: number): PlatformStream => ({ title: "Bonus hunt", viewers, startedAt: null, category: null });
const manualOff = { live: false, platform: "twitch" as const };

describe("resolveLiveStatus", () => {
  it("prioriza Twitch cuando está en vivo en las dos plataformas", () => {
    const status = resolveLiveStatus({ twitch: stream(100), kick: stream(900), manual: manualOff });
    expect(status).toMatchObject({ live: true, platform: "twitch", source: "api", viewers: 100 });
  });

  it("usa Kick si solo Kick está en vivo", () => {
    const status = resolveLiveStatus({ twitch: null, kick: stream(50), manual: manualOff });
    expect(status).toMatchObject({ live: true, platform: "kick", viewers: 50 });
  });

  it("cae al interruptor manual si las APIs no detectan nada", () => {
    const status = resolveLiveStatus({ twitch: null, kick: null, manual: { live: true, platform: "kick" } });
    expect(status).toMatchObject({ live: true, platform: "kick", source: "manual", viewers: null });
  });

  it("queda offline sin señales", () => {
    expect(resolveLiveStatus({ twitch: null, kick: null, manual: manualOff }).live).toBe(false);
  });
});
