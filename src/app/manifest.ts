import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chupetti",
    short_name: "Chupetti",
    description: "Bonus hunts, buys, battles, Wager Race y sorteos en vivo.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0712",
    theme_color: "#0b0712",
    lang: "es-AR",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
