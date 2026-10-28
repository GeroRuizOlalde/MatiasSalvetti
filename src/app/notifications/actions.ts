"use server";

import { createClient } from "@/lib/supabase/server";

/** Se llama al abrir la campanita: todo lo anterior queda como leído. */
export async function markNotificationsRead(scope: "site" | "panel") {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", { p_panel: scope === "panel" });
}
