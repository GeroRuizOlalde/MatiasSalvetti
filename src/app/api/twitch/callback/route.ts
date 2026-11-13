import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requirePanelProfile } from "@/lib/auth/session";
import { currentOrigin } from "@/lib/origin";
import { connectChannel, syncEventSubSubscriptions, TWITCH_STATE_COOKIE } from "@/lib/twitch/channel";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Vuelta de Twitch después de aceptar los permisos del canal. */
export async function GET(request: NextRequest) {
  const profile = await requirePanelProfile("admin");
  const origin = await currentOrigin();
  const back = (params: Record<string, string>) => {
    const response = NextResponse.redirect(`${origin}/panel/twitch?${new URLSearchParams(params)}`);
    response.cookies.delete({ name: TWITCH_STATE_COOKIE, path: "/api/twitch" });
    return response;
  };

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expected = request.cookies.get(TWITCH_STATE_COOKIE)?.value;
  // El que tocó «Cancelar» en Twitch vuelve con `error=access_denied`.
  if (searchParams.get("error")) return back({ error: "denied" });
  if (!code || !state || !expected || !same(state, expected)) return back({ error: "state" });

  const result = await connectChannel(code, profile.id, origin);
  if (!result.ok) return back({ error: result.reason });

  // De paso se dejan creadas las suscripciones a los eventos.
  const sync = await syncEventSubSubscriptions(origin).catch(() => null);
  return back({ ok: sync?.ok && !sync.failed.length ? "connected" : "connected_no_events" });
}
