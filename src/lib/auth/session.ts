import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/types/database";

export type CurrentProfile = Pick<
  Tables<"profiles">,
  | "id"
  | "role"
  | "twitch_login"
  | "display_name"
  | "avatar_url"
  | "twitch_created_at"
  | "adult_confirmed_at"
  | "terms_version"
  | "banned_at"
  | "xp"
  | "level"
  | "points"
  | "tickets"
  | "created_at"
>;

const PROFILE_COLUMNS =
  "id, role, twitch_login, display_name, avatar_url, twitch_created_at, adult_confirmed_at, terms_version, banned_at, xp, level, points, tickets, created_at";

/** Perfil del usuario logueado (una consulta por request). Lee cookies: usar dentro de un <Suspense>. */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  // Leer cookies siempre marca la ruta como dinámica, aunque Supabase no esté configurado.
  await cookies();
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  return data;
});

export function isPanelRole(role: Enums<"user_role">) {
  return role === "mod" || role === "admin";
}

/** Corta el render si el usuario no tiene el rol pedido. Repetir en cada Server Action del panel. */
export async function requirePanelProfile(minRole: "mod" | "admin" = "mod") {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/panel/login");
  const allowed = minRole === "admin" ? profile.role === "admin" : isPanelRole(profile.role);
  if (profile.banned_at || !allowed) redirect("/panel/login?error=sin-permiso");
  return profile;
}

export function needsOnboarding(
  profile: Pick<CurrentProfile, "adult_confirmed_at" | "terms_version">,
  termsVersion: number | null,
) {
  if (!profile.adult_confirmed_at) return true;
  if (termsVersion !== null && (profile.terms_version ?? 0) < termsVersion) return true;
  return false;
}

/** Solo rutas internas, para no convertir `?next=` en un redirect abierto. */
export function safeNext(value: unknown, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
