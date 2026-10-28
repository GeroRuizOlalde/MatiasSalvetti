export type Platform = "twitch" | "kick";

export type PlatformStream = {
  title: string;
  viewers: number;
  startedAt: string | null;
  category: string | null;
};

export type LiveStatus = {
  live: boolean;
  platform: Platform | null;
  /** `api` si lo detectó Twitch/Kick, `manual` si viene del interruptor del panel. */
  source: "api" | "manual" | null;
  title: string | null;
  viewers: number | null;
  startedAt: string | null;
};

const OFFLINE: LiveStatus = { live: false, platform: null, source: null, title: null, viewers: null, startedAt: null };

/** Twitch tiene prioridad sobre Kick; el interruptor manual es el último recurso. */
export function resolveLiveStatus({
  twitch,
  kick,
  manual,
}: {
  twitch: PlatformStream | null;
  kick: PlatformStream | null;
  manual: { live: boolean; platform: Platform };
}): LiveStatus {
  const detected: [Platform, PlatformStream | null][] = [
    ["twitch", twitch],
    ["kick", kick],
  ];
  for (const [platform, stream] of detected) {
    if (stream) {
      return {
        live: true,
        platform,
        source: "api",
        title: stream.title || null,
        viewers: stream.viewers,
        startedAt: stream.startedAt,
      };
    }
  }
  if (manual.live) return { ...OFFLINE, live: true, platform: manual.platform, source: "manual" };
  return OFFLINE;
}
