import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, requireSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente anónimo sin cookies, para leer datos públicos dentro de funciones con
 * `"use cache"`. Devuelve null si Supabase todavía no está configurado.
 */
export function createPublicClient() {
  if (!isSupabaseConfigured()) return null;
  const { url, key } = requireSupabaseEnv();
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
