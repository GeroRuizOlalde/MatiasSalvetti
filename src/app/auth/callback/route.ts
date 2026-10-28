import { NextResponse, type NextRequest } from "next/server";
import { getTwitchUserById, isTwitchConfigured } from "@/lib/external/twitch";
import { needsOnboarding, safeNext } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { getLegalDocument } from "@/lib/legal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const fail = () => NextResponse.redirect(new URL("/entrar?error=oauth", request.url));

  if (!code) return fail();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, twitch_id, twitch_created_at, adult_confirmed_at, terms_version")
    .eq("id", data.user.id)
    .single();
  if (!profile) return fail();

  if (!profile.twitch_created_at && profile.twitch_id) {
    await syncTwitchAccountAge(profile.id, profile.twitch_id);
  }

  const terms = await getLegalDocument("terms");
  const destination = needsOnboarding(profile, terms?.version ?? null)
    ? `/bienvenida?next=${encodeURIComponent(next)}`
    : next;

  return NextResponse.redirect(new URL(destination, request.url));
}

/** Guarda la fecha de creación de la cuenta de Twitch (para el filtro anti-multicuentas). */
async function syncTwitchAccountAge(userId: string, twitchId: string) {
  if (!isTwitchConfigured() || !serverEnv.SUPABASE_SECRET_KEY) return;
  try {
    const twitchUser = await getTwitchUserById(twitchId);
    if (!twitchUser) return;
    await createAdminClient()
      .from("profiles")
      .update({ twitch_created_at: twitchUser.created_at })
      .eq("id", userId);
  } catch (error) {
    // No bloquea el login: se reintenta en el próximo.
    console.error("[auth] no se pudo leer la cuenta de Twitch", error);
  }
}
