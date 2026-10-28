import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  TWITCH_CLIENT_ID: z.string().min(1).optional(),
  TWITCH_CLIENT_SECRET: z.string().min(1).optional(),
  TWITCH_CHANNEL_LOGIN: z.string().min(1).default("chupetti"),
  KICK_CLIENT_ID: z.string().min(1).optional(),
  KICK_CLIENT_SECRET: z.string().min(1).optional(),
  KICK_CHANNEL_SLUG: z.string().min(1).default("chupetti"),
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  YOUTUBE_CHANNEL_ID: z.string().min(1).optional(),
  YOUTUBE_HANDLE: z.string().min(1).default("@ChupettiClips"),
});

export const serverEnv = serverSchema.parse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID || undefined,
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET || undefined,
  TWITCH_CHANNEL_LOGIN: process.env.TWITCH_CHANNEL_LOGIN || undefined,
  KICK_CLIENT_ID: process.env.KICK_CLIENT_ID || undefined,
  KICK_CLIENT_SECRET: process.env.KICK_CLIENT_SECRET || undefined,
  KICK_CHANNEL_SLUG: process.env.KICK_CHANNEL_SLUG || undefined,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || undefined,
  YOUTUBE_CHANNEL_ID: process.env.YOUTUBE_CHANNEL_ID || undefined,
  YOUTUBE_HANDLE: process.env.YOUTUBE_HANDLE || undefined,
});
