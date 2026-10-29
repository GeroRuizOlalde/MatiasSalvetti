import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Casinos para elegir en los formularios del panel: solo los activos (así no aparece
 * uno que se sacó, como Win Win). Si la sesión ya usa uno desactivado, se mantiene
 * para no borrárselo al guardar.
 */
export function casinoOptions(supabase: Client, currentId?: string | null) {
  const query = supabase.from("casinos").select("id, name");
  return (currentId ? query.or(`is_active.eq.true,id.eq.${currentId}`) : query.eq("is_active", true))
    .order("sort_order")
    .order("name");
}
