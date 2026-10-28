// Mensajes para los errores de las funciones de participación (calls, GTB, votos, picks).
export const VIEWER_ERRORS: Record<string, string> = {
  not_authenticated: "Entrá con Twitch para participar.",
  cannot_participate: "Todavía no podés participar: revisá que hayas aceptado las bases y los requisitos de tu cuenta.",
  rate_limited: "Vas muy rápido. Esperá un minuto y probá de nuevo.",
};

export function viewerError(message: string, extra: Record<string, string> = {}) {
  const errors = { ...VIEWER_ERRORS, ...extra };
  const key = Object.keys(errors).find((k) => message.includes(k));
  return key ? errors[key] : "No se pudo guardar. Probá de nuevo.";
}
