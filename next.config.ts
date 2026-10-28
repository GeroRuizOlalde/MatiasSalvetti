import type { NextConfig } from "next";

function supabaseHost() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return null;
  }
}
const storageHost = supabaseHost();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  cacheLife: {
    // Estado en vivo de Twitch/Kick: se consulta a las APIs como mucho una vez por minuto.
    live: { stale: 30, revalidate: 60, expire: 300 },
  },
  images: {
    remotePatterns: [
      // Avatares de Twitch
      { protocol: "https", hostname: "static-cdn.jtvnw.net" },
      // Miniaturas de YouTube
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
      ...(storageHost ? [{ protocol: "https" as const, hostname: storageHost, pathname: "/storage/v1/object/public/**" }] : []),
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
