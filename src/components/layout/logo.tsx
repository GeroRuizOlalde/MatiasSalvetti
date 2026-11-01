import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { BRAND_ASSETS, hasBrandAsset } from "@/lib/brand";

export function Logo({ className, lang = "es" }: { className?: string; lang?: Locale }) {
  const { src, width, height } = BRAND_ASSETS.logo;
  const { t, href } = getI18n(lang);
  return (
    <Link href={href("/")} aria-label={t.layout.logoLabel} className={className}>
      {hasBrandAsset("logo") ? (
        <Image src={src} alt="" width={width} height={height} priority className="h-12 w-auto" />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-10 items-center gap-1 font-display text-3xl tracking-wide text-accent-light"
        >
          <span className="size-0 border-x-[10px] border-b-[18px] border-x-transparent border-b-accent" />
          MS
        </span>
      )}
    </Link>
  );
}
