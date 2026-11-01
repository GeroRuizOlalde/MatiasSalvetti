import { Suspense } from "react";
import { ChatOverlay } from "@/components/overlay/chat-overlay";
import { OverlayGate } from "@/components/overlay/overlay-gate";
import { serverEnv } from "@/lib/env.server";

/**
 * Chat de Twitch para OBS, sin fondo (lo pone la escena). Opciones en la URL:
 * `&ocultar=nightbot,streamelements` (bots que no se muestran), `&max=20` (mensajes en
 * pantalla) y `&segundos=60` (cuánto queda cada mensaje; sin esto no se van).
 */
export default function ChatOverlayPage({ searchParams }: PageProps<"/overlay/chat">) {
  return (
    <Suspense fallback={null}>
      <OverlayGate searchParams={searchParams}>
        <Chat searchParams={searchParams} />
      </OverlayGate>
    </Suspense>
  );
}

async function Chat({ searchParams }: { searchParams: PageProps<"/overlay/chat">["searchParams"] }) {
  const params = await searchParams;
  const text = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const number = (key: string, fallback: number, maxValue: number) => {
    const n = Number.parseInt(text(key), 10);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, maxValue) : fallback;
  };
  const hidden = text("ocultar")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  return (
    <ChatOverlay
      channel={serverEnv.TWITCH_CHANNEL_LOGIN}
      hidden={hidden}
      max={number("max", 20, 100) || 20}
      seconds={number("segundos", 0, 3600)}
    />
  );
}
