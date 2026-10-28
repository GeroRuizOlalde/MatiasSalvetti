import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";

// API pública oficial de Kick (https://docs.kick.com) con app access token.

let appToken: { value: string; expiresAt: number } | null = null;

const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number() });

function credentials() {
  const { KICK_CLIENT_ID: clientId, KICK_CLIENT_SECRET: clientSecret } = serverEnv;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isKickConfigured() {
  return credentials() !== null;
}

async function getAppAccessToken() {
  const creds = credentials();
  if (!creds) throw new Error("Faltan KICK_CLIENT_ID y KICK_CLIENT_SECRET.");
  if (appToken && appToken.expiresAt > Date.now() + 60_000) return appToken.value;

  const res = await fetch("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kick token: HTTP ${res.status}`);
  const json = tokenSchema.parse(await res.json());
  appToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return appToken.value;
}

const channelsSchema = z.object({
  data: z.array(
    z.object({
      slug: z.string(),
      stream_title: z.string().nullish(),
      category: z.object({ name: z.string().nullish() }).nullish(),
      stream: z
        .object({
          is_live: z.boolean(),
          viewer_count: z.number().nullish(),
          start_time: z.string().nullish(),
        })
        .nullish(),
    }),
  ),
});

/** Stream en vivo del canal, o null si está offline. */
export async function getKickStream(slug: string) {
  const token = await getAppAccessToken();
  const res = await fetch(`https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 401) appToken = null;
  if (!res.ok) throw new Error(`Kick channels: HTTP ${res.status}`);

  const channel = channelsSchema.parse(await res.json()).data[0];
  if (!channel?.stream?.is_live) return null;
  return {
    title: channel.stream_title ?? "",
    viewers: channel.stream.viewer_count ?? 0,
    startedAt: channel.stream.start_time ?? null,
    category: channel.category?.name ?? null,
  };
}
