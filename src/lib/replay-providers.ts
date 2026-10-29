// Reconocer de qué proveedor es un link de replay. Sin "server-only": lo usan la web y el panel.

export type ReplayProvider = { id: string; name: string; domain: string; embeddable: boolean };

/** "https://www.ppreplaylink.net/abc" -> "ppreplaylink.net". null si no es un link https. */
export function replayHost(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** El proveedor cuyo dominio es el host o uno de sus padres (el más específico gana). */
export function matchProvider<T extends Pick<ReplayProvider, "domain">>(host: string, providers: T[]) {
  return (
    providers
      .filter((p) => host === p.domain || host.endsWith(`.${p.domain}`))
      .sort((a, b) => b.domain.length - a.domain.length)[0] ?? null
  );
}

/** Lo que el panel escribe en "Dominio": acepta un link entero y se queda con el dominio. */
export function normalizeDomain(input: string) {
  const text = input.trim().toLowerCase();
  const host = replayHost(text.startsWith("http") ? text.replace(/^http:/, "https:") : `https://${text}`);
  return host && /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(host) ? host : null;
}
