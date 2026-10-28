import Image from "next/image";
import { cn } from "@/lib/cn";
import { BRAND_ASSETS, hasBrandAsset } from "@/lib/brand";

/** «by 1XSLOTS», el partner oficial. */
export function PartnerLogo({ className, imageClassName }: { className?: string; imageClassName?: string }) {
  const { src, width, height } = BRAND_ASSETS.partner;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="font-marker text-[0.55em] leading-none text-accent-text">by</span>
      {hasBrandAsset("partner") ? (
        <Image
          src={src}
          alt="1xSlots"
          width={width}
          height={height}
          className={cn("h-[0.8em] w-auto", imageClassName)}
        />
      ) : (
        <span className="font-display tracking-wide text-gold">1XSLOTS</span>
      )}
    </span>
  );
}
