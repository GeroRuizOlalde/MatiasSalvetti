import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requirePanelProfile } from "@/lib/auth/session";
import { isTwitchConfigured } from "@/lib/external/twitch";
import { currentOrigin } from "@/lib/origin";
import { channelAuthorizeUrl, TWITCH_STATE_COOKIE } from "@/lib/twitch/channel";

/** Arranca la autorización del canal: manda al admin a la pantalla de permisos de Twitch. */
export async function GET() {
  await requirePanelProfile("admin");
  const origin = await currentOrigin();
  if (!isTwitchConfigured()) return NextResponse.redirect(`${origin}/panel/twitch?error=config`);

  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(channelAuthorizeUrl(state, origin));
  response.cookies.set(TWITCH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/twitch",
    maxAge: 600,
  });
  return response;
}
