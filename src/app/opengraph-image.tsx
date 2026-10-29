import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Imagen por defecto al compartir cualquier página en redes y mensajería.
export const alt = "Chupetti — bonus hunts, buys, battles, Wager Race y sorteos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const character = await readFile(join(process.cwd(), "public/brand/personaje.png"));
  const src = `data:image/png;base64,${character.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 80px",
        background: "radial-gradient(circle at 70% 40%, #3b1a63 0%, #0b0712 60%)",
        color: "#f4f0fa",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
        <div style={{ fontSize: 34, color: "#c99bff", letterSpacing: 4, textTransform: "uppercase" }}>by 1xSlots</div>
        <div style={{ fontSize: 110, fontWeight: 900, lineHeight: 1, marginTop: 12, textTransform: "uppercase" }}>
          Chupetti
        </div>
        <div style={{ fontSize: 34, color: "#b4a8c8", marginTop: 28, lineHeight: 1.3 }}>
          Bonus hunts, buys y battles en vivo. Wager Race y sorteos para la comunidad.
        </div>
        <div style={{ fontSize: 26, color: "#ffc94d", marginTop: 36 }}>+18 · Jugá con responsabilidad</div>
      </div>
      <img src={src} alt="" width={420} height={525} style={{ objectFit: "contain" }} />
    </div>,
    size,
  );
}
