import { NextResponse, type NextRequest } from "next/server";
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

// Chequeo optimista: cada layout y cada acción del panel vuelve a verificar el rol en el servidor.
export async function proxy(request: NextRequest) {
  const { response, supabase, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  const next = pathname + search;

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
    return redirectWithCookies(request, response, "/entrar", { next });
  }

  return response;
}

export const config = {
  matcher: [
    // Todo menos estáticos, imágenes, overlays y archivos con extensión.
    "/((?!_next/static|_next/image|overlay|brand|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
