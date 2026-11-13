import "server-only";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/env";

/** Dirección con la que se está usando la web en este pedido (dominio real, no el de fábrica). */
export async function currentOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
