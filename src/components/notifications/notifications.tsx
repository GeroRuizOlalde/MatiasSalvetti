import { getNotifications, type NotificationScope } from "@/lib/notifications";
import { NotificationBell } from "./notification-bell";

/** Lee la sesión: va dentro de un <Suspense>. Sin sesión no muestra nada. */
export async function Notifications({
  scope,
  align,
}: {
  scope: NotificationScope;
  align?: "left" | "right" | "sidebar";
}) {
  const data = await getNotifications(scope);
  if (!data) return null;
  return <NotificationBell scope={scope} align={align} {...data} />;
}
