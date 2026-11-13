import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { getTwitchStream, isTwitchConfigured } from "@/lib/external/twitch";
import { createAdminClient } from "@/lib/supabase/admin";
import { getChatters } from "@/lib/twitch/channel";

// Tarea de cada 5 minutos (la llama pg_cron desde Supabase): si el canal está en vivo,
// suma los puntos por ver a los que están en el chat. Offline no hace nada.

/** Twitch tarda un poco en mostrar el stream recién empezado: no se cierra uno tan nuevo. */
const JUST_STARTED_MS = 3 * 60_000;

function authorized(request: Request) {
  const secret = serverEnv.CRON_SECRET;
  const sent = request.headers.get("authorization");
  if (!secret || !sent) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(sent);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function run(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isTwitchConfigured() || !serverEnv.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const supabase = createAdminClient();
  let stream: Awaited<ReturnType<typeof getTwitchStream>>;
  try {
    stream = await getTwitchStream(serverEnv.TWITCH_CHANNEL_LOGIN);
  } catch {
    return NextResponse.json({ error: "twitch_unavailable" }, { status: 502 });
  }

  if (!stream) {
    const { data: open } = await supabase
      .from("twitch_streams")
      .select("started_at")
      .is("ended_at", null)
      .maybeSingle();
    if (open && Date.now() - Date.parse(open.started_at) > JUST_STARTED_MS) {
      await supabase.rpc("twitch_set_stream", { p_live: false });
    }
    return NextResponse.json({ live: false, credited: 0 });
  }

  const { error: streamError } = await supabase.rpc("twitch_set_stream", {
    p_live: true,
    p_stream_id: stream.id,
    p_started_at: stream.startedAt,
  });
  if (streamError) return NextResponse.json({ error: "database" }, { status: 500 });

  const chatters = await getChatters();
  // Sin el permiso del canal no se sabe quién está mirando.
  if (!chatters) return NextResponse.json({ live: true, credited: 0, error: "channel_not_connected" });

  const { data: credited, error } = await supabase.rpc("twitch_watch_tick", { p_twitch_users: chatters });
  if (error) return NextResponse.json({ error: "database" }, { status: 500 });
  return NextResponse.json({ live: true, chatters: chatters.length, credited: credited ?? 0 });
}

export const GET = run;
export const POST = run;
