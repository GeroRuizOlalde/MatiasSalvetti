"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { localePath, splitLocale } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/server";
import { safeNext } from "@/lib/auth/session";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function signInWithTwitch(formData: FormData) {
  const next = safeNext(formData.get("next"));
  // Los errores se muestran en el idioma de la página desde la que se entró.
  const login = localePath(splitLocale(next).lang, "/entrar");
  if (!isSupabaseConfigured()) redirect(`${login}?error=config`);

  const origin = (await headers()).get("origin") ?? publicEnv.NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "twitch",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error || !data.url) redirect(`${login}?error=oauth`);
  redirect(data.url);
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(localePath(await getRequestLocale(), "/"));
}
