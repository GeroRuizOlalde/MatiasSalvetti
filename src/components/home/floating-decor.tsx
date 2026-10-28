import type { CSSProperties } from "react";

// Fichas y cartas que flotan de fondo en el hero. Lentas (11–15 s) y con poca rotación.
// Los palos llevan U+FE0E para que se dibujen como texto y nunca como emoji.

type Item = {
  kind: "chip" | "card";
  label?: string;
  red?: boolean;
  top: string;
  left: string;
  size: number;
  duration: number;
  delay: number;
  rotate: number;
  opacity: number;
};

const ITEMS: Item[] = [
  { kind: "chip", top: "12%", left: "4%", size: 54, duration: 13, delay: 0, rotate: -12, opacity: 0.5 },
  { kind: "card", label: "A♠︎", top: "64%", left: "2%", size: 58, duration: 15, delay: -4, rotate: -14, opacity: 0.35 },
  { kind: "chip", top: "78%", left: "38%", size: 40, duration: 11, delay: -2, rotate: 10, opacity: 0.4 },
  { kind: "card", label: "K♥︎", red: true, top: "8%", left: "46%", size: 52, duration: 14, delay: -7, rotate: 12, opacity: 0.3 },
  { kind: "chip", top: "18%", left: "90%", size: 46, duration: 12, delay: -5, rotate: 6, opacity: 0.45 },
  { kind: "card", label: "A♥︎", red: true, top: "70%", left: "88%", size: 48, duration: 13, delay: -9, rotate: 16, opacity: 0.3 },
];

export function FloatingDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {ITEMS.map((item, i) => {
        const style = {
          top: item.top,
          left: item.left,
          width: item.size,
          opacity: item.opacity,
          animationDuration: `${item.duration}s`,
          animationDelay: `${item.delay}s`,
          "--drift-rotate": `${item.rotate}deg`,
        } as CSSProperties;
        return (
          <div key={i} className="absolute animate-drift" style={style}>
            {item.kind === "chip" ? <Chip /> : <Card label={item.label ?? ""} red={item.red} />}
          </div>
        );
      })}
    </div>
  );
}

function Chip() {
  return (
    <svg viewBox="0 0 64 64" className="w-full drop-shadow-[0_0_10px_rgb(157_59_255/0.5)]">
      <circle cx="32" cy="32" r="30" fill="#9d3bff" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="#e2c8ff" strokeWidth="6" strokeDasharray="10 9.6" />
      <circle cx="32" cy="32" r="19" fill="#151021" stroke="#e2c8ff" strokeWidth="2" />
      <circle cx="32" cy="32" r="12" fill="none" stroke="#9d3bff" strokeWidth="2" strokeDasharray="3 3" />
    </svg>
  );
}

function Card({ label, red }: { label: string; red?: boolean }) {
  return (
    <div
      className="flex aspect-[5/7] w-full items-start rounded-md border border-line-strong bg-[#f4f0fa] p-1 shadow-[0_0_18px_rgb(157_59_255/0.35)]"
      style={{ fontVariantEmoji: "text" } as CSSProperties}
    >
      <span className={`font-display text-sm leading-none ${red ? "text-[#d6204a]" : "text-[#0b0712]"}`}>{label}</span>
    </div>
  );
}
