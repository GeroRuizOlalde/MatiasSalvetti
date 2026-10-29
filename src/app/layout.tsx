import type { Metadata, Viewport } from "next";
import { Anton, JetBrains_Mono, Manrope, Permanent_Marker } from "next/font/google";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });
const permanentMarker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-permanent-marker",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: "Chupetti", template: "%s · Chupetti" },
  description: "La web oficial de Chupetti: bonus hunts, bonus buys, bonus battles, Wager Race y sorteos en vivo.",
  openGraph: { type: "website", locale: "es_AR", siteName: "Chupetti" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0b0712", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      // El script de abajo puede poner data-sidebar antes de que cargue React.
      suppressHydrationWarning
      className={`${anton.variable} ${manrope.variable} ${jetbrainsMono.variable} ${permanentMarker.variable}`}
    >
      <head>
        {/* Aplica el menú achicado antes de pintar para que no salte (ver components/layout/sidebar.tsx). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("ms-sidebar")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
