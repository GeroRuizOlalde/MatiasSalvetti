import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Cliente con la secret key: saltea RLS. Solo para lógica de servidor que ya
 * verificó permisos (sorteos, puntos, sincronizar datos de Twitch).
 */
export function createAdminClient() {
  const { url } = requireSupabaseEnv();
  const secret = serverEnv.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Falta SUPABASE_SECRET_KEY en el entorno.");
  return createSupabaseClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
