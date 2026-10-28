import Image from "next/image";

export function Avatar({ url, name, size = 32 }: { url: string | null; name: string; size?: number }) {
  if (!url) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white"
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <Image src={url} alt="" width={size} height={size} className="shrink-0 rounded-full" />;
}
