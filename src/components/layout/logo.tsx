import Image from "next/image";
import Link from "next/link";
import { BRAND_ASSETS, hasBrandAsset } from "@/lib/brand";

export function Logo({ className }: { className?: string }) {
  const { src, width, height } = BRAND_ASSETS.logo;
  return (
    <Link href="/" aria-label="Chupetti, ir al inicio" className={className}>
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
