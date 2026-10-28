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
    // Hunts: el panel invalida el tag en cada cambio; esto cubre las apuestas del GTB.
    hunt: { stale: 30, revalidate: 30, expire: 3600 },
  },
  images: {
    remotePatterns: [
      // Avatares de Twitch
      { protocol: "https", hostname: "static-cdn.jtvnw.net" },
      // Miniaturas de YouTube
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
      ...(storageHost
        ? [{ protocol: "https" as const, hostname: storageHost, pathname: "/storage/v1/object/public/**" }]
        : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // Nadie embebe la web en un iframe (OBS abre los overlays directo, no los embebe).
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
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
