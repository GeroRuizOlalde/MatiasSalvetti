import "server-only";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type NotificationScope = "site" | "panel";
export type NotificationItem = Pick<Tables<"notifications">, "id" | "kind" | "title" | "body" | "link" | "created_at">;

const LIMIT = 20;

/**
 * Últimas notificaciones del usuario logueado y hasta cuándo las leyó. En la web van las
 * suyas y las generales; en el panel, las de trabajo. Lee la sesión: va dentro de un <Suspense>.
 */
export async function getNotifications(scope: NotificationScope) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const audiences: Tables<"notifications">["audience"][] = scope === "panel" ? ["panel"] : ["user", "all"];
  const [{ data: items }, { data: marks }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, link, created_at")
      .in("audience", audiences)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("profiles")
      .select("notifications_read_at, panel_notifications_read_at")
      .eq("id", profile.id)
      .maybeSingle(),
  ]);

  const readAt = scope === "panel" ? marks?.panel_notifications_read_at : marks?.notifications_read_at;
  return { items: items ?? [], readAt: readAt ?? null };
}
