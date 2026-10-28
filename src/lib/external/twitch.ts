import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";

// API Helix con app access token (client credentials). El token se reusa
// mientras vive la instancia y se renueva un minuto antes de vencer.

let appToken: { value: string; expiresAt: number } | null = null;

const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number() });

function credentials() {
  const { TWITCH_CLIENT_ID: clientId, TWITCH_CLIENT_SECRET: clientSecret } = serverEnv;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isTwitchConfigured() {
  return credentials() !== null;
}

async function getAppAccessToken() {
  const creds = credentials();
  if (!creds) throw new Error("Faltan TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET.");
  if (appToken && appToken.expiresAt > Date.now() + 60_000) return appToken.value;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Twitch token: HTTP ${res.status}`);
  const json = tokenSchema.parse(await res.json());
  appToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return appToken.value;
}

async function helix<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const creds = credentials();
  if (!creds) throw new Error("Twitch no está configurado.");
  const token = await getAppAccessToken();
  const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
    headers: { "Client-Id": creds.clientId, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) appToken = null;
  if (!res.ok) throw new Error(`Twitch ${path}: HTTP ${res.status}`);
  return schema.parse(await res.json());
}

const usersSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      login: z.string(),
      display_name: z.string(),
      profile_image_url: z.string(),
      created_at: z.string(),
    }),
  ),
});

export async function getTwitchUserById(id: string) {
  const json = await helix(`users?id=${encodeURIComponent(id)}`, usersSchema);
  return json.data[0] ?? null;
}

const streamsSchema = z.object({
  data: z.array(
    z.object({
      type: z.string(),
      title: z.string(),
      viewer_count: z.number(),
      started_at: z.string(),
      game_name: z.string().optional(),
    }),
  ),
});

/** Stream en vivo del canal, o null si está offline. */
export async function getTwitchStream(login: string) {
  const json = await helix(`streams?user_login=${encodeURIComponent(login)}`, streamsSchema);
  const stream = json.data.find((s) => s.type === "live");
  if (!stream) return null;
  return {
    title: stream.title,
    viewers: stream.viewer_count,
    startedAt: stream.started_at,
    category: stream.game_name ?? null,
  };
}
