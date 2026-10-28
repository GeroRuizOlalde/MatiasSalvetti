import { Play } from "lucide-react";
import Image from "next/image";
import { BrandIcon } from "@/components/ui/brand-icon";
import { buttonClasses } from "@/components/ui/button";
import type { YoutubeVideo } from "@/lib/external/youtube";
import { formatDate } from "@/lib/format";
import { SectionHeading } from "./section-heading";

export function ClipsSection({ videos, channelUrl }: { videos: YoutubeVideo[]; channelUrl: string }) {
  return (
    <section aria-labelledby="clips-title" className="mx-auto max-w-7xl px-4 py-16">
      <SectionHeading id="clips-title" kicker="lo mejor del stream" title="Últimos clips" />

      {videos.length === 0 ? (
        <div className="reveal flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center">
          <BrandIcon name="youtube" className="size-10 text-accent-text" />
          <p className="max-w-md text-sm text-muted">Mirá todos los clips en el canal de YouTube.</p>
          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "secondary" })}
          >
            Ir al canal
          </a>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-3">
          {videos.map((video) => (
            <li key={video.id} className="reveal">
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group lift block overflow-hidden rounded-2xl border border-line bg-surface hover:border-accent/60"
              >
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src={video.thumbnail}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-bg/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play className="size-12 fill-white text-white" aria-hidden />
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-2 font-semibold">{video.title}</h3>
                  <p className="mt-1 text-xs text-subtle">{formatDate(video.publishedAt)}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
