import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { Card, Chip } from "./floating-decor";

// Decoración alrededor del personaje del hero. Las imágenes de slots y el señor
// Monopoly son arte de sus dueños (Pragmatic Play, Hasbro): están todas en esta
// lista para poder sacarlas de un saque si alguna vez lo piden.
const STICKERS = [
  {
    src: "/decor/orbe.webp",
    w: 320,
    h: 290,
    className: "-top-4 -right-4 w-24 sm:-right-10 sm:w-32",
    duration: 7,
    delay: 0,
    rotate: 6,
  },
  {
    src: "/decor/bomba.webp",
    w: 320,
    h: 301,
    className: "top-[18%] -left-4 w-20 sm:-left-14 sm:w-28",
    duration: 8,
    delay: -2,
    rotate: -8,
  },
  {
    src: "/decor/cohete.webp",
    w: 320,
    h: 360,
    className: "-right-2 bottom-[22%] w-16 sm:-right-12 sm:w-24",
    duration: 6.5,
    delay: -4,
    rotate: 10,
  },
  {
    src: "/decor/monopoly.webp",
    w: 238,
    h: 339,
    className: "bottom-[-2%] right-[12%] w-16 sm:w-20",
    duration: 9,
    delay: -1,
    rotate: -4,
  },
] as const;

/** Cartas de blackjack y fichas que giran alrededor del personaje. */
const ORBIT: { kind: "chip" | "card"; label?: string; red?: boolean; angle: number; size: number }[] = [
  { kind: "card", label: "A♠︎", angle: 20, size: 34 },
  { kind: "chip", angle: 80, size: 30 },
  { kind: "card", label: "K♥︎", red: true, angle: 150, size: 32 },
  { kind: "chip", angle: 215, size: 26 },
  { kind: "card", label: "J♣︎", angle: 270, size: 30 },
  { kind: "card", label: "Q♦︎", red: true, angle: 330, size: 32 },
];

export function HeroDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* Anillo que gira lento; cada pieza gira al revés para quedar derecha. El radio es la mitad del anillo (50cqw). */}
      <div
        className="absolute inset-x-[2%] top-[6%] aspect-square animate-orbit"
        style={{ containerType: "inline-size" }}
      >
        {ORBIT.map((item, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2"
            style={{
              width: item.size,
              marginLeft: -item.size / 2,
              marginTop: -item.size / 2,
              transform: `rotate(${item.angle}deg) translateY(-50cqw) rotate(${-item.angle}deg)`,
            }}
          >
            <div className="animate-orbit-reverse">
              {item.kind === "chip" ? <Chip /> : <Card label={item.label ?? ""} red={item.red} />}
            </div>
          </div>
        ))}
      </div>

      {STICKERS.map((sticker) => (
        <div
          key={sticker.src}
          className={cn("absolute animate-bob drop-shadow-[0_8px_24px_rgb(157_59_255/0.45)]", sticker.className)}
          style={
            {
              animationDuration: `${sticker.duration}s`,
              animationDelay: `${sticker.delay}s`,
              "--bob-rotate": `${sticker.rotate}deg`,
            } as CSSProperties
          }
        >
          <Image
            src={sticker.src}
            alt=""
            width={sticker.w}
            height={sticker.h}
            sizes="128px"
            className="h-auto w-full"
          />
        </div>
      ))}
    </div>
  );
}
