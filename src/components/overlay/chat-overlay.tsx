"use client";

import { Gem, Star, Swords, Video, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  emoteUrl,
  parseIrcLine,
  readableColor,
  TWITCH_IRC_URL,
  type ChatBadge,
  type ChatMessage,
} from "@/lib/twitch-chat";

const BADGES: Record<ChatBadge, { icon: LucideIcon; className: string }> = {
  broadcaster: { icon: Video, className: "text-live" },
  moderator: { icon: Swords, className: "text-emerald-400" },
  vip: { icon: Gem, className: "text-pink-400" },
  subscriber: { icon: Star, className: "text-accent-light" },
};

type Received = ChatMessage & { at: number };

/**
 * Chat de Twitch en vivo para OBS: se conecta anónimo al IRC del canal, muestra los
 * últimos mensajes abajo de todo y saca los que borra la moderación.
 */
export function ChatOverlay({
  channel,
  hidden,
  max,
  seconds,
}: {
  channel: string;
  /** Usuarios que no se muestran (bots), en minúscula. */
  hidden: string[];
  max: number;
  /** Segundos que queda cada mensaje en pantalla (0 = no se van). */
  seconds: number;
}) {
  const [messages, setMessages] = useState<Received[]>([]);
  // Los overlays se refrescan cada pocos segundos: con la lista como texto, la conexión no se rehace.
  const hiddenKey = hidden.join(",");

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let stopped = false;

    const connect = () => {
      socket = new WebSocket(TWITCH_IRC_URL);
      socket.onopen = () => {
        attempts = 0;
        socket?.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
        socket?.send("PASS SCHMOOPIIE");
        socket?.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
        socket?.send(`JOIN #${channel.toLowerCase()}`);
      };
      socket.onmessage = (event) => {
        for (const line of String(event.data).split("\r\n")) {
          const parsed = parseIrcLine(line);
          if (!parsed) continue;
          if (parsed.type === "ping") socket?.send(`PONG ${parsed.payload}`);
          else if (parsed.type === "message") {
            if (hiddenKey.split(",").includes(parsed.message.login.toLowerCase())) continue;
            setMessages((list) => [...list, { ...parsed.message, at: Date.now() }].slice(-max));
          } else if (parsed.type === "delete") setMessages((list) => list.filter((m) => m.id !== parsed.messageId));
          else if (parsed.type === "clear-user") setMessages((list) => list.filter((m) => m.userId !== parsed.userId));
          else if (parsed.type === "clear-all") setMessages([]);
        }
      };
      // Se reconecta solo, esperando cada vez un poco más (hasta 30 s).
      socket.onclose = () => {
        if (stopped) return;
        retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempts++));
      };
    };
    connect();

    return () => {
      stopped = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [channel, hiddenKey, max]);

  // Los mensajes viejos se van solos si se pidió.
  useEffect(() => {
    if (!seconds) return;
    const id = setInterval(() => {
      const limit = Date.now() - seconds * 1000;
      setMessages((list) => (list.some((m) => m.at < limit) ? list.filter((m) => m.at >= limit) : list));
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);

  return <ChatList messages={messages} />;
}

/** Los mensajes, de más viejo a más nuevo, pegados abajo. */
export function ChatList({ messages }: { messages: ChatMessage[] }) {
  return (
    <ol className="flex h-[calc(100dvh-1.5rem)] flex-col justify-end gap-2 overflow-hidden" aria-live="off">
      {messages.map((message) => {
        const color = readableColor(message.color, message.login);
        return (
          <li
            key={message.id}
            className="animate-rise border-l-[3px] pl-2.5 [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]"
            style={{ borderColor: color }}
          >
            <p className="flex items-center gap-1.5 text-base font-extrabold" style={{ color }}>
              {message.badges.map((badge) => {
                const { icon: Icon, className } = BADGES[badge];
                return <Icon key={badge} className={cn("size-4 shrink-0", className)} aria-label={badge} />;
              })}
              <span className="truncate">{message.name}</span>
            </p>
            <p
              className={cn("text-[19px] leading-snug font-semibold break-words", message.action && "italic")}
              style={message.action ? { color } : undefined}
            >
              {message.parts.map((part, i) =>
                part.type === "emote" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- emotes del CDN de Twitch, sin optimizar
                  <img
                    key={i}
                    src={emoteUrl(part.id)}
                    alt={part.name}
                    className="mx-0.5 inline-block h-8 w-auto align-middle"
                  />
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
