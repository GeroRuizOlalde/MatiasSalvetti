import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { serverEnv } from "@/lib/env.server";
import { getKickStream, isKickConfigured } from "@/lib/external/kick";
import { getTwitchStream, isTwitchConfigured } from "@/lib/external/twitch";
import { resolveLiveStatus, type PlatformStream } from "@/lib/live-status-resolve";
import { getPublicSettings } from "@/lib/settings";

export type { LiveStatus } from "@/lib/live-status-resolve";

/** Estado de Twitch y Kick desde sus APIs oficiales, cacheado ~60 s en el servidor. */
async function getApiStreams(): Promise<{ twitch: PlatformStream | null; kick: PlatformStream | null }> {
  "use cache";
  cacheTag("live-status");
  cacheLife("live");

  const [twitch, kick] = await Promise.allSettled([
    isTwitchConfigured() ? getTwitchStream(serverEnv.TWITCH_CHANNEL_LOGIN) : Promise.resolve(null),
    isKickConfigured() ? getKickStream(serverEnv.KICK_CHANNEL_SLUG) : Promise.resolve(null),
  ]);
  if (twitch.status === "rejected") console.error("[live] twitch", twitch.reason);
  if (kick.status === "rejected") console.error("[live] kick", kick.reason);

  return {
    twitch: twitch.status === "fulfilled" ? twitch.value : null,
    kick: kick.status === "fulfilled" ? kick.value : null,
  };
}

export async function getLiveStatus() {
  const [streams, settings] = await Promise.all([getApiStreams(), getPublicSettings()]);
  return resolveLiveStatus({ ...streams, manual: settings.stream_manual });
}
