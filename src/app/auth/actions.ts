"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/session";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function signInWithTwitch(formData: FormData) {
  const next = safeNext(formData.get("next"));
  if (!isSupabaseConfigured()) redirect("/entrar?error=config");

  const origin = (await headers()).get("origin") ?? publicEnv.NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "twitch",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error || !data.url) redirect("/entrar?error=oauth");
  redirect(data.url);
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
