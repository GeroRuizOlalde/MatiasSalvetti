import type { Messages } from "@/i18n/messages";

/**
 * Traduce los `raise exception '<código>'` de las funciones de participación (calls, GTB,
 * misiones, sorteos…) a un mensaje para el viewer, en el idioma de la página.
 */
export function viewerError(t: Messages, message: string, extra: Record<string, string> = {}) {
  const errors = { ...t.actions.viewer, ...extra };
  const key = Object.keys(errors).find((k) => message.includes(k));
  return key ? errors[key] : t.actions.fallback;
}
