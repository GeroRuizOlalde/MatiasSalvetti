import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, localePath, splitLocale } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/proxy";

const VIEWER_ONLY = ["/cuartel", "/perfil", "/bienvenida"];

function redirectWithCookies(request: NextRequest, from: NextResponse, pathname: string, params: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = new URLSearchParams(params).toString();
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

/** Rutas que no son de la web pública: no tienen idioma. */
const NO_LOCALE = ["/panel", "/auth", "/overlay", "/api"];

/** Copia las cookies de la sesión a otra respuesta (rewrite o redirect). */
function withCookies(to: NextResponse, from: NextResponse) {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  // Headers propios de la sesión (ej. cache-control); los x-middleware-* son internos de cada respuesta.
  for (const [name, value] of from.headers) {
    if (!name.startsWith("x-middleware-") && name !== "set-cookie") to.headers.set(name, value);
  }
  return to;
}

// Chequeo optimista: cada layout y cada acción del panel vuelve a verificar el rol en el servidor.
export async function proxy(request: NextRequest) {
  const { pathname: fullPath, search } = request.nextUrl;

  // /es/... no existe hacia afuera: el español va sin prefijo.
  if (fullPath === "/es" || fullPath.startsWith("/es/")) {
    const url = request.nextUrl.clone();
    url.pathname = fullPath.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  const { response, supabase, userId } = await updateSession(request);
  const isPublic = !NO_LOCALE.some((p) => fullPath === p || fullPath.startsWith(`${p}/`));
  const { lang, path: pathname } = isPublic ? splitLocale(fullPath) : { lang: DEFAULT_LOCALE, path: fullPath };
  const next = fullPath + search;

  const isPanel = pathname === "/panel" || (pathname.startsWith("/panel/") && !pathname.startsWith("/panel/login"));
  if (isPanel) {
    if (!userId || !supabase) {
      return redirectWithCookies(request, response, "/panel/login", { next });
    }
    const { data: profile } = await supabase.from("profiles").select("role, banned_at").eq("id", userId).single();
    if (!profile || profile.banned_at || profile.role === "viewer") {
      return redirectWithCookies(request, response, "/panel/login", { error: "sin-permiso" });
    }
  }

  if (!userId && VIEWER_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return redirectWithCookies(request, response, localePath(lang, "/entrar"), { next });
  }

  if (!isPublic) return response;

  // Las páginas públicas viven en /[lang]: las URLs sin prefijo son las de español.
  const url = request.nextUrl.clone();
  url.pathname = lang === DEFAULT_LOCALE ? `/${DEFAULT_LOCALE}${fullPath === "/" ? "" : fullPath}` : fullPath;
  const rewritten = withCookies(
    lang === DEFAULT_LOCALE ? NextResponse.rewrite(url, { request }) : NextResponse.next({ request }),
    response,
  );
  // Para que las Server Actions respondan en el idioma de la página.
  if (request.cookies.get(LOCALE_COOKIE)?.value !== lang) {
    rewritten.cookies.set(LOCALE_COOKIE, lang, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }
  return rewritten;
}

export const config = {
  matcher: [
    // Todo menos lo interno de Next, los overlays, los webhooks, las imágenes de metadata y los archivos con extensión.
    "/((?!_next|overlay|api/twitch/eventsub|api/cron|opengraph-image|twitter-image|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
