import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { requireSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/** Cliente con la sesión del usuario (respeta RLS). Lee cookies: usar dentro de un <Suspense>. */
export async function createClient() {
  const { url, key } = requireSupabaseEnv();
  // Supabase usa la hora (vencimiento del token): Next tiene que saber que esto es por request,
  // si no lo marca como "Date.now() while prerendering" en los prefetch.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy refresca la sesión.
        }
      },
    },
  });
}
