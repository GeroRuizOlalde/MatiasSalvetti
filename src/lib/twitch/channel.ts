import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";
import { twitchAppFetch, twitchCredentials } from "@/lib/external/twitch";
import { createAdminClient } from "@/lib/supabase/admin";

// Autorización del canal (la da Matías una sola vez) y lo que se hace con ella:
// leer quién está en el chat y mantener las suscripciones de EventSub.
// Los tokens viven en `twitch_channel_auth` y solo se leen con la secret key.

export const CHANNEL_SCOPES = [
  "moderator:read:followers",
  "channel:read:subscriptions",
  "bits:read",
  "moderator:read:chatters",
  "user:read:chat",
  "user:bot",
  "channel:bot",
] as const;

export const TWITCH_REDIRECT_PATH = "/api/twitch/callback";
export const TWITCH_STATE_COOKIE = "twitch_channel_state";
export const EVENTSUB_PATH = "/api/twitch/eventsub";

// `origin` es el dominio con el que el admin está usando el panel (ver `currentOrigin`).
export const twitchRedirectUri = (origin: string) => `${origin}${TWITCH_REDIRECT_PATH}`;
export const eventSubCallbackUrl = (origin: string) => `${origin}${EVENTSUB_PATH}`;

/** Qué falta configurar para que funcione todo. Solo nombres, nunca valores. */
export function missingTwitchEnv() {
  const missing: string[] = [];
  if (!serverEnv.TWITCH_CLIENT_ID) missing.push("TWITCH_CLIENT_ID");
  if (!serverEnv.TWITCH_CLIENT_SECRET) missing.push("TWITCH_CLIENT_SECRET");
  if (!serverEnv.TWITCH_EVENTSUB_SECRET) missing.push("TWITCH_EVENTSUB_SECRET");
  if (!serverEnv.TWITCH_BROADCASTER_ID) missing.push("TWITCH_BROADCASTER_ID");
  if (!serverEnv.CRON_SECRET) missing.push("CRON_SECRET");
  if (!serverEnv.SUPABASE_SECRET_KEY) missing.push("SUPABASE_SECRET_KEY");
  return missing;
}

export function channelAuthorizeUrl(state: string, origin: string) {
  const creds = twitchCredentials();
  if (!creds) throw new Error("Twitch no está configurado.");
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: twitchRedirectUri(origin),
    response_type: "code",
    scope: CHANNEL_SCOPES.join(" "),
    state,
    // Que siempre muestre la pantalla de permisos: es la cuenta del canal la que tiene que aceptar.
    force_verify: "true",
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  scope: z.array(z.string()).optional(),
});

const validateSchema = z.object({ user_id: z.string(), login: z.string(), scopes: z.array(z.string()).nullable() });

async function requestToken(params: Record<string, string>) {
  const creds = twitchCredentials();
  if (!creds) throw new Error("Twitch no está configurado.");
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: creds.clientId, client_secret: creds.clientSecret, ...params }),
    cache: "no-store",
  });
  return res;
}

export type ConnectResult =
  | { ok: true; login: string }
  | { ok: false; reason: "exchange" | "wrong_account" | "missing_scopes" | "save" };

/** Cambia el `code` del OAuth por los tokens del canal y los guarda. */
export async function connectChannel(code: string, connectedBy: string, origin: string): Promise<ConnectResult> {
  const res = await requestToken({
    code,
    grant_type: "authorization_code",
    redirect_uri: twitchRedirectUri(origin),
  });
  if (!res.ok) return { ok: false, reason: "exchange" };
  const token = tokenSchema.parse(await res.json());

  const validate = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${token.access_token}` },
    cache: "no-store",
  });
  if (!validate.ok) return { ok: false, reason: "exchange" };
  const who = validateSchema.parse(await validate.json());

  // Tiene que ser la cuenta del canal, no la de un mod o la del que arma la web.
  const expectedId = serverEnv.TWITCH_BROADCASTER_ID;
  const isChannel = expectedId
    ? who.user_id === expectedId
    : who.login === serverEnv.TWITCH_CHANNEL_LOGIN.toLowerCase();
  if (!isChannel) return { ok: false, reason: "wrong_account" };

  const scopes = who.scopes ?? token.scope ?? [];
  if (CHANNEL_SCOPES.some((scope) => !scopes.includes(scope))) return { ok: false, reason: "missing_scopes" };

  const supabase = createAdminClient();
  // Una sola fila: la del canal.
  await supabase.from("twitch_channel_auth").delete().neq("broadcaster_id", who.user_id);
  const { error } = await supabase.from("twitch_channel_auth").upsert({
    broadcaster_id: who.user_id,
    login: who.login,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    scopes,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    needs_reconnect: false,
    connected_by: connectedBy,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, reason: "save" };
  return { ok: true, login: who.login };
}

export type ChannelStatus = {
  connected: boolean;
  login: string | null;
  broadcasterId: string | null;
  needsReconnect: boolean;
  connectedAt: string | null;
};

/** Estado de la conexión, sin los tokens. */
export async function getChannelStatus(): Promise<ChannelStatus> {
  const empty = { connected: false, login: null, broadcasterId: null, needsReconnect: false, connectedAt: null };
  if (!serverEnv.SUPABASE_SECRET_KEY) return empty;
  const { data } = await createAdminClient()
    .from("twitch_channel_auth")
    .select("broadcaster_id, login, needs_reconnect, connected_at")
    .limit(1)
    .maybeSingle();
  if (!data) return empty;
  return {
    connected: true,
    login: data.login,
    broadcasterId: data.broadcaster_id,
    needsReconnect: data.needs_reconnect,
    connectedAt: data.connected_at,
  };
}

/** Borra la autorización guardada y le avisa a Twitch que el token ya no vale. */
export async function disconnectChannel() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("twitch_channel_auth").select("access_token").limit(1).maybeSingle();
  const creds = twitchCredentials();
  if (data && creds) {
    await fetch("https://id.twitch.tv/oauth2/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: creds.clientId, token: data.access_token }),
      cache: "no-store",
    }).catch(() => null);
  }
  await supabase.from("twitch_channel_auth").delete().neq("broadcaster_id", "");
  // Los eventos eran de ese canal: se borran para que no sigan llegando ni queden pegados.
  await deleteAllSubscriptions().catch((error) => console.error("[twitch] no se pudieron borrar los eventos", error));
  await supabase.from("twitch_subscriptions").delete().neq("type", "");
}

type ChannelToken = { broadcasterId: string; accessToken: string };

/** Token del canal, renovado si está por vencer. Null si no está conectado o hay que reconectar. */
export async function getChannelToken(forceRefresh = false): Promise<ChannelToken | null> {
  const supabase = createAdminClient();
  const { data: auth } = await supabase
    .from("twitch_channel_auth")
    .select("broadcaster_id, access_token, refresh_token, expires_at, needs_reconnect")
    .limit(1)
    .maybeSingle();
  if (!auth || auth.needs_reconnect) return null;

  const fresh = Date.parse(auth.expires_at) > Date.now() + 5 * 60_000;
  if (fresh && !forceRefresh) return { broadcasterId: auth.broadcaster_id, accessToken: auth.access_token };

  const res = await requestToken({ grant_type: "refresh_token", refresh_token: auth.refresh_token });
  if (!res.ok) {
    // 400/401: Twitch dio de baja el refresh token (cambió la contraseña o desconectó la app).
    if (res.status === 400 || res.status === 401) {
      await supabase
        .from("twitch_channel_auth")
        .update({ needs_reconnect: true, updated_at: new Date().toISOString() })
        .eq("broadcaster_id", auth.broadcaster_id);
    }
    return null;
  }
  const token = tokenSchema.parse(await res.json());
  await supabase
    .from("twitch_channel_auth")
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("broadcaster_id", auth.broadcaster_id);
  return { broadcasterId: auth.broadcaster_id, accessToken: token.access_token };
}

const chattersSchema = z.object({
  data: z.array(z.object({ user_id: z.string() })),
  pagination: z.object({ cursor: z.string().optional() }).optional(),
});

/** IDs de Twitch de todos los que están en el chat ahora (paginado). Null si no se pudo leer. */
export async function getChatters(): Promise<string[] | null> {
  const creds = twitchCredentials();
  if (!creds) return null;
  let token = await getChannelToken();
  if (!token) return null;

  const ids: string[] = [];
  let cursor: string | undefined;
  // Tope de páginas por las dudas: 50 × 1000 chatters.
  for (let page = 0; page < 50; page += 1) {
    const params = new URLSearchParams({
      broadcaster_id: token.broadcasterId,
      moderator_id: token.broadcasterId,
      first: "1000",
    });
    if (cursor) params.set("after", cursor);
    let res = await fetch(`https://api.twitch.tv/helix/chat/chatters?${params}`, {
      headers: { "Client-Id": creds.clientId, Authorization: `Bearer ${token.accessToken}` },
      cache: "no-store",
    });
    if (res.status === 401) {
      // El token se venció antes de lo que decía: se renueva una vez y se reintenta.
      token = await getChannelToken(true);
      if (!token) return null;
      res = await fetch(`https://api.twitch.tv/helix/chat/chatters?${params}`, {
        headers: { "Client-Id": creds.clientId, Authorization: `Bearer ${token.accessToken}` },
        cache: "no-store",
      });
    }
    if (!res.ok) return null;
    const json = chattersSchema.parse(await res.json());
    ids.push(...json.data.map((c) => c.user_id));
    cursor = json.pagination?.cursor;
    if (!cursor) break;
  }
  return ids;
}

// -----------------------------------------------------------------------------
// Suscripciones de EventSub (se crean con el app access token)
// -----------------------------------------------------------------------------

type Wanted = { type: string; version: string; label: string; condition: (id: string) => Record<string, string> };

const broadcaster = (id: string) => ({ broadcaster_user_id: id });

export const EVENTSUB_TYPES: Wanted[] = [
  { type: "stream.online", version: "1", label: "Empieza el stream", condition: broadcaster },
  { type: "stream.offline", version: "1", label: "Termina el stream", condition: broadcaster },
  {
    type: "channel.follow",
    version: "2",
    label: "Follow",
    condition: (id) => ({ broadcaster_user_id: id, moderator_user_id: id }),
  },
  { type: "channel.subscribe", version: "1", label: "Sub nueva", condition: broadcaster },
  { type: "channel.subscription.gift", version: "1", label: "Subs regaladas", condition: broadcaster },
  { type: "channel.subscription.message", version: "1", label: "Resub", condition: broadcaster },
  { type: "channel.cheer", version: "1", label: "Bits", condition: broadcaster },
  { type: "channel.raid", version: "1", label: "Raid", condition: (id) => ({ to_broadcaster_user_id: id }) },
  {
    type: "channel.chat.message",
    version: "1",
    label: "Mensajes del chat",
    condition: (id) => ({ broadcaster_user_id: id, user_id: id }),
  },
];

const subscriptionsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      type: z.string(),
      version: z.string(),
      condition: z.record(z.string(), z.string().nullable()).default({}),
      transport: z.object({ method: z.string(), callback: z.string().optional() }),
    }),
  ),
  pagination: z.object({ cursor: z.string().optional() }).optional(),
});

async function listSubscriptions() {
  const all: z.infer<typeof subscriptionsSchema>["data"] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const res = await twitchAppFetch(`eventsub/subscriptions${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`);
    if (!res.ok) throw new Error(`Twitch eventsub: HTTP ${res.status}`);
    const json = subscriptionsSchema.parse(await res.json());
    all.push(...json.data);
    cursor = json.pagination?.cursor;
    if (!cursor) break;
  }
  return all;
}

const ALIVE = ["enabled", "webhook_callback_verification_pending"];

/** Misma condición: mismo canal (y mismo moderador o usuario, según el evento). */
export function sameCondition(actual: Record<string, string | null>, wanted: Record<string, string>) {
  return Object.entries(wanted).every(([key, value]) => actual[key] === value);
}

/** Borra en Twitch todas las suscripciones de esta app a los eventos que usa la web. */
async function deleteAllSubscriptions() {
  const types = new Set(EVENTSUB_TYPES.map((t) => t.type));
  for (const sub of await listSubscriptions()) {
    if (types.has(sub.type)) {
      await twitchAppFetch(`eventsub/subscriptions?id=${encodeURIComponent(sub.id)}`, { method: "DELETE" });
    }
  }
}

export type SyncResult = { ok: true; created: number; failed: string[] } | { ok: false; error: string };

/**
 * Deja las suscripciones como tienen que estar: crea las que faltan, reemplaza las caídas
 * y borra las que apuntan a otra URL. Guarda el estado de cada una para el panel.
 */
export async function syncEventSubSubscriptions(origin: string): Promise<SyncResult> {
  const secret = serverEnv.TWITCH_EVENTSUB_SECRET;
  if (!secret) return { ok: false, error: "Falta TWITCH_EVENTSUB_SECRET." };
  const status = await getChannelStatus();
  if (!status.connected || !status.broadcasterId || status.needsReconnect) {
    return { ok: false, error: "Primero conectá el canal de Twitch." };
  }
  const callback = eventSubCallbackUrl(origin);
  if (!callback.startsWith("https://")) {
    return { ok: false, error: "Twitch solo manda eventos a una URL https: no funciona en localhost." };
  }

  let existing: Awaited<ReturnType<typeof listSubscriptions>>;
  try {
    existing = await listSubscriptions();
  } catch {
    return { ok: false, error: "Twitch no respondió. Probá de nuevo en un rato." };
  }

  const supabase = createAdminClient();
  const failed: string[] = [];
  let created = 0;

  for (const wanted of EVENTSUB_TYPES) {
    const mine = existing.filter((s) => s.type === wanted.type);
    const condition = wanted.condition(status.broadcasterId);
    const good = mine.find(
      (s) =>
        s.version === wanted.version &&
        s.transport.callback === callback &&
        ALIVE.includes(s.status) &&
        sameCondition(s.condition, condition),
    );
    // Lo que sobra (caídas, de otra URL, de otro canal, repetidas) se borra.
    for (const stale of mine.filter((s) => s !== good)) {
      await twitchAppFetch(`eventsub/subscriptions?id=${encodeURIComponent(stale.id)}`, { method: "DELETE" });
    }

    let row: { twitch_id: string | null; status: string };
    if (good) {
      row = { twitch_id: good.id, status: good.status };
    } else {
      const res = await twitchAppFetch("eventsub/subscriptions", {
        method: "POST",
        body: {
          type: wanted.type,
          version: wanted.version,
          condition,
          transport: { method: "webhook", callback, secret },
        },
      });
      if (res.ok) {
        const json = subscriptionsSchema.parse(await res.json());
        row = { twitch_id: json.data[0]?.id ?? null, status: json.data[0]?.status ?? "enabled" };
        created += 1;
      } else {
        failed.push(wanted.type);
        row = { twitch_id: null, status: `error_${res.status}` };
      }
    }
    await supabase.from("twitch_subscriptions").upsert({
      type: wanted.type,
      version: wanted.version,
      twitch_id: row.twitch_id,
      status: row.status,
      updated_at: new Date().toISOString(),
    });
  }
  return { ok: true, created, failed };
}
