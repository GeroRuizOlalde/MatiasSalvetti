// Lectura del chat de Twitch por IRC (WebSocket, anónimo): sin tokens ni bots.
// Se usa en el overlay de chat para OBS.

export const TWITCH_IRC_URL = "wss://irc-ws.chat.twitch.tv:443";

export type ChatPart = { type: "text"; text: string } | { type: "emote"; id: string; name: string };

export type ChatBadge = "broadcaster" | "moderator" | "vip" | "subscriber";

export type ChatMessage = {
  id: string;
  userId: string;
  login: string;
  name: string;
  color: string | null;
  badges: ChatBadge[];
  /** /me: el mensaje va en cursiva y del color del usuario. */
  action: boolean;
  parts: ChatPart[];
};

/** Lo que importa del chat: mensajes nuevos y los que borra la moderación. */
export type ChatEvent =
  | { type: "message"; message: ChatMessage }
  | { type: "delete"; messageId: string }
  | { type: "clear-user"; userId: string }
  | { type: "clear-all" }
  | { type: "ping"; payload: string };

const TAG_ESCAPES: Record<string, string> = { ":": ";", s: " ", "\\": "\\", r: "\r", n: "\n" };

function unescapeTag(value: string) {
  return value.replace(/\\(.)/g, (_, c: string) => TAG_ESCAPES[c] ?? c);
}

function parseTags(raw: string) {
  const tags: Record<string, string> = {};
  for (const pair of raw.split(";")) {
    const i = pair.indexOf("=");
    if (i > 0) tags[pair.slice(0, i)] = unescapeTag(pair.slice(i + 1));
  }
  return tags;
}

/** "25:0-4,12-16/1902:6-10" + texto -> partes de texto y emotes (las posiciones son por caracter Unicode). */
export function splitEmotes(text: string, emotesTag: string | undefined): ChatPart[] {
  const chars = Array.from(text);
  const ranges: { start: number; end: number; id: string }[] = [];
  for (const group of (emotesTag ?? "").split("/")) {
    const [id, positions] = group.split(":");
    if (!id || !positions) continue;
    for (const pos of positions.split(",")) {
      const [start, end] = pos.split("-").map(Number);
      if (Number.isInteger(start) && Number.isInteger(end) && end >= start && end < chars.length) {
        ranges.push({ start, end, id });
      }
    }
  }
  ranges.sort((a, b) => a.start - b.start);

  const parts: ChatPart[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) parts.push({ type: "text", text: chars.slice(cursor, range.start).join("") });
    parts.push({ type: "emote", id: range.id, name: chars.slice(range.start, range.end + 1).join("") });
    cursor = range.end + 1;
  }
  if (cursor < chars.length) parts.push({ type: "text", text: chars.slice(cursor).join("") });
  return parts;
}

function parseBadges(raw: string | undefined): ChatBadge[] {
  const names = (raw ?? "").split(",").map((b) => b.split("/")[0]);
  const badges: ChatBadge[] = [];
  if (names.includes("broadcaster")) badges.push("broadcaster");
  if (names.includes("moderator")) badges.push("moderator");
  if (names.includes("vip")) badges.push("vip");
  if (names.includes("subscriber") || names.includes("founder")) badges.push("subscriber");
  return badges;
}

/** Una línea de IRC -> evento del chat, o null si no interesa. */
export function parseIrcLine(line: string): ChatEvent | null {
  let rest = line.trim();
  if (!rest) return null;
  if (rest.startsWith("PING")) return { type: "ping", payload: rest.slice(5) || ":tmi.twitch.tv" };

  let tags: Record<string, string> = {};
  if (rest.startsWith("@")) {
    const space = rest.indexOf(" ");
    tags = parseTags(rest.slice(1, space));
    rest = rest.slice(space + 1);
  }
  let prefix = "";
  if (rest.startsWith(":")) {
    const space = rest.indexOf(" ");
    prefix = rest.slice(1, space);
    rest = rest.slice(space + 1);
  }
  const colon = rest.indexOf(" :");
  const head = colon >= 0 ? rest.slice(0, colon) : rest;
  const trailing = colon >= 0 ? rest.slice(colon + 2) : "";
  const [command, target] = head.split(" ");

  if (command === "CLEARMSG" && tags["target-msg-id"]) return { type: "delete", messageId: tags["target-msg-id"] };
  if (command === "CLEARCHAT") {
    return tags["target-user-id"] ? { type: "clear-user", userId: tags["target-user-id"] } : { type: "clear-all" };
  }
  if (command !== "PRIVMSG" || !target) return null;

  const login = prefix.split("!")[0];
  let text = trailing;
  let action = false;
  const actionMatch = /^\u0001ACTION (.*)\u0001$/.exec(text);
  if (actionMatch) {
    text = actionMatch[1];
    action = true;
  }
  return {
    type: "message",
    message: {
      id: tags.id || `${login}-${Date.now()}`,
      userId: tags["user-id"] ?? login,
      login,
      name: tags["display-name"] || login,
      color: tags.color || null,
      badges: parseBadges(tags.badges),
      action,
      parts: splitEmotes(text, tags.emotes),
    },
  };
}

const FALLBACK_COLORS = ["#c99bff", "#ffc94d", "#5eead4", "#f9a8d4", "#93c5fd", "#86efac", "#fdba74"];

/**
 * Color del nombre, legible sobre fondo oscuro: los muy oscuros (ej. azul puro) se aclaran.
 * Sin color propio, uno fijo según el usuario.
 */
export function readableColor(color: string | null, login: string) {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) {
    const hash = Array.from(login).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
  }
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance >= 0.3) return color;
  // Se mezcla con blanco hasta que se lea.
  const mix = (c: number) => Math.round(c + (255 - c) * (0.3 - luminance + 0.25));
  return `#${[r, g, b].map((c) => Math.min(255, mix(c)).toString(16).padStart(2, "0")).join("")}`;
}

export function emoteUrl(id: string) {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/default/dark/2.0`;
}
