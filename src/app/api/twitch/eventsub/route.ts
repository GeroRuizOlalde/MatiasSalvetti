import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyEventSub } from "@/lib/twitch/eventsub-signature";
import type { Json } from "@/types/database";

// Webhook de EventSub: Twitch avisa acá cada follow, sub, mensaje del chat, etc.
// Se verifica la firma con el cuerpo crudo antes de mirar nada más.

type Body = {
  challenge?: string;
  subscription?: { type?: string; status?: string };
  event?: Json;
};

export async function POST(request: Request) {
  const secret = serverEnv.TWITCH_EVENTSUB_SECRET;
  if (!secret || !serverEnv.SUPABASE_SECRET_KEY) return new Response("No configurado.", { status: 503 });

  const raw = await request.text();
  const messageId = request.headers.get("twitch-eventsub-message-id");
  const check = verifyEventSub(
    secret,
    {
      id: messageId,
      timestamp: request.headers.get("twitch-eventsub-message-timestamp"),
      signature: request.headers.get("twitch-eventsub-message-signature"),
    },
    raw,
  );
  if (!check.ok || !messageId) return new Response("Firma inválida.", { status: 403 });

  let body: Body;
  try {
    body = JSON.parse(raw) as Body;
  } catch {
    return new Response("Cuerpo inválido.", { status: 400 });
  }
  const kind = request.headers.get("twitch-eventsub-message-type");
  const type = body.subscription?.type;
  const supabase = createAdminClient();

  if (kind === "webhook_callback_verification") {
    if (typeof body.challenge !== "string") return new Response("Falta el challenge.", { status: 400 });
    if (type) {
      await supabase
        .from("twitch_subscriptions")
        .update({ status: "enabled", updated_at: new Date().toISOString() })
        .eq("type", type);
    }
    return new Response(body.challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  if (kind === "revocation") {
    // Twitch dio de baja la suscripción (se sacó el permiso, falló el webhook…): se ve en el panel.
    if (type) {
      await supabase
        .from("twitch_subscriptions")
        .update({ status: body.subscription?.status ?? "revoked", updated_at: new Date().toISOString() })
        .eq("type", type);
    }
    return new Response(null, { status: 204 });
  }

  if (kind === "notification" && type) {
    // Los reintentos de Twitch se descartan adentro, por el ID del mensaje.
    const { error } = await supabase.rpc("twitch_handle_event", {
      p_message_id: messageId,
      p_type: type,
      p_payload: body.event ?? {},
    });
    if (error) {
      console.error("[twitch] no se pudo procesar el evento", type, error.message);
      // Con un 5xx Twitch lo vuelve a mandar.
      return new Response("Error al procesar.", { status: 500 });
    }
  }
  return new Response(null, { status: 204 });
}
