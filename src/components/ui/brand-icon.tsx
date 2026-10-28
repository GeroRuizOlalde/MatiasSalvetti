import { siDiscord, siInstagram, siKick, siTiktok, siTwitch, siWhatsapp, siYoutube } from "simple-icons";

// Íconos de marca de simple-icons (CC0): lucide-react ya no incluye logos de marcas.
const ICONS = {
  twitch: siTwitch,
  kick: siKick,
  youtube: siYoutube,
  instagram: siInstagram,
  tiktok: siTiktok,
  discord: siDiscord,
  whatsapp: siWhatsapp,
} as const;

export type BrandName = keyof typeof ICONS;

export function BrandIcon({ name, className }: { name: BrandName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className ?? "size-5"}>
      <path d={ICONS[name].path} />
    </svg>
  );
}

export const BRAND_LABELS: Record<BrandName, string> = {
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  discord: "Discord",
  whatsapp: "WhatsApp",
};
