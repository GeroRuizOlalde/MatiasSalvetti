import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";

// YouTube Data API v3: últimos videos subidos al canal de clips, cacheados 1 h.

export type YoutubeVideo = {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
};

const API = "https://www.googleapis.com/youtube/v3";

const channelsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        contentDetails: z.object({ relatedPlaylists: z.object({ uploads: z.string() }) }),
      }),
    )
    .default([]),
});

const thumbSchema = z.object({ url: z.string() });

const playlistSchema = z.object({
  items: z
    .array(
      z.object({
        snippet: z.object({
          title: z.string(),
          publishedAt: z.string(),
          resourceId: z.object({ videoId: z.string() }),
          thumbnails: z.object({
            medium: thumbSchema.optional(),
            high: thumbSchema.optional(),
            default: thumbSchema.optional(),
          }),
        }),
      }),
    )
    .default([]),
});

async function getJson(path: string, params: Record<string, string>) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries({ ...params, key: serverEnv.YOUTUBE_API_KEY ?? "" })) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`YouTube ${path}: HTTP ${res.status}`);
  return res.json();
}

/** Últimos `count` videos, o [] si YouTube no está configurado o falla. */
export async function getLatestVideos(count = 3): Promise<YoutubeVideo[]> {
  "use cache";
  cacheTag("youtube");
  cacheLife("hours");

  if (!serverEnv.YOUTUBE_API_KEY) return [];
  try {
    const channelParams: Record<string, string> = serverEnv.YOUTUBE_CHANNEL_ID
      ? { id: serverEnv.YOUTUBE_CHANNEL_ID }
      : { forHandle: serverEnv.YOUTUBE_HANDLE };
    const channel = channelsSchema.parse(await getJson("channels", { part: "contentDetails", ...channelParams })).items[0];
    if (!channel) return [];

    const playlist = playlistSchema.parse(
      await getJson("playlistItems", {
        part: "snippet",
        playlistId: channel.contentDetails.relatedPlaylists.uploads,
        maxResults: String(count),
      }),
    );

    return playlist.items.map(({ snippet }) => {
      const thumbs = snippet.thumbnails;
      const id = snippet.resourceId.videoId;
      return {
        id,
        title: snippet.title,
        publishedAt: snippet.publishedAt,
        thumbnail: (thumbs.high ?? thumbs.medium ?? thumbs.default)?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${id}`,
      };
    });
  } catch (error) {
    console.error("[youtube]", error);
    return [];
  }
}
