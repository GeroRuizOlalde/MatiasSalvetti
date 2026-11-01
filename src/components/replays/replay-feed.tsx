"use client";

import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";
import { Clapperboard, Heart, Link2, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toggleReplayLike } from "@/app/[lang]/(site)/replays/actions";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { formatDate, formatInteger, formatMoney, formatMulti } from "@/lib/format";
import type { PublicReplay } from "@/lib/replays";
import { ReplayComments } from "./replay-comments";
import { ReplayEditButton } from "./replay-edit-button";
import { ReplayViewer } from "./replay-viewer";

/** Quién está mirando el feed: para marcar sus me gusta y dejarle comentar. */
export type ReplayViewerUser = { id: string; isMod: boolean; likedIds: string[] };

const SORTS = ["new", "likes", "multi"] as const;

type Sort = (typeof SORTS)[number];

/** Los replays como publicaciones: montos, me gusta, comentarios y compartir. */
type Providers = { name: string; domain: string }[];

export function ReplayFeed({
  replays,
  viewer,
  providers,
}: {
  replays: PublicReplay[];
  viewer: ReplayViewerUser | null;
  providers: Providers;
}) {
  const [provider, setProvider] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("new");
  const { t } = useI18n();

  if (!replays.length) {
    return (
      <EmptyState icon={Clapperboard} title={t.replays.emptyTitle}>
        {t.replays.empty}
      </EmptyState>
    );
  }

  const others = t.replays.others;
  const providerNames = [...new Set(replays.map((r) => r.provider?.name ?? others))].sort();
  const shown = replays
    .filter((r) => !provider || (r.provider?.name ?? others) === provider)
    .sort((a, b) => {
      if (sort === "likes") return b.likes_count - a.likes_count || b.created_at.localeCompare(a.created_at);
      if (sort === "multi") return (b.multi ?? 0) - (a.multi ?? 0) || b.created_at.localeCompare(a.created_at);
      return b.created_at.localeCompare(a.created_at);
    });

  const chip = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1 text-sm font-semibold transition-colors",
      active ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-text",
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {providerNames.length > 1 ? (
          <div role="group" aria-label={t.replays.provider} className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={!provider}
              onClick={() => setProvider(null)}
              className={chip(!provider)}
            >
              {t.replays.all}
            </button>
            {providerNames.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={provider === name}
                onClick={() => setProvider(name)}
                className={chip(provider === name)}
              >
                {name}
              </button>
            ))}
          </div>
        ) : null}
        <label className="ml-auto flex items-center gap-2 text-sm text-subtle">
          {t.replays.sort}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-text"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t.replays.sorts[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="space-y-4">
        {shown.map((replay) => (
          <li key={replay.id}>
            <ReplayPost replay={replay} viewer={viewer} providers={providers} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReplayPost({
  replay,
  viewer,
  providers,
}: {
  replay: PublicReplay;
  viewer: ReplayViewerUser | null;
  providers: Providers;
}) {
  const [liked, setLiked] = useState(() => viewer?.likedIds.includes(replay.id) ?? false);
  const [likes, setLikes] = useState(replay.likes_count);
  const [comments, setComments] = useState(replay.comments_count);
  const [showComments, setShowComments] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { t, lang } = useI18n();
  const r = t.replays;

  const name = replay.user?.name ?? "Viewer";
  const stats = [
    replay.bet !== null ? { label: r.bet, value: formatMoney(replay.bet, replay.currency) } : null,
    replay.bonus_cost !== null ? { label: r.bonusCost, value: formatMoney(replay.bonus_cost, replay.currency) } : null,
    replay.payout !== null ? { label: r.paid, value: formatMoney(replay.payout, replay.currency), gold: true } : null,
    replay.multi !== null ? { label: r.multi, value: formatMulti(replay.multi), gold: true } : null,
  ].filter((s) => s !== null);

  const like = () => {
    if (!viewer) {
      setNotice(r.loginToLike);
      return;
    }
    // Se marca al instante y, si la base dice otra cosa, se corrige.
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    startTransition(async () => {
      const result = await toggleReplayLike(replay.id);
      if ("error" in result) {
        setLiked(!next);
        setLikes((n) => n + (next ? -1 : 1));
        setNotice(result.error);
      } else if (result.liked !== next) {
        setLiked(result.liked);
        setLikes((n) => n + (result.liked ? 1 : -1));
      }
    });
  };

  const share = async () => {
    const url = `${window.location.origin}${localePath(lang, "/replays")}#replay-${replay.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice(r.linkCopied);
    } catch {
      setNotice(url);
    }
    setTimeout(() => setNotice(null), 2500);
  };

  return (
    <article id={`replay-${replay.id}`} className="scroll-mt-24 rounded-2xl border border-line bg-surface">
      <header className="flex items-center gap-3 px-4 pt-4">
        <Avatar url={replay.user?.avatarUrl ?? null} name={name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs text-subtle">
            {replay.provider ? `${replay.provider.name} · ` : ""}
            {formatDate(replay.created_at, lang)}
            {replay.edited_at ? ` · ${r.edited}` : ""}
          </p>
        </div>
        {viewer && (viewer.id === replay.user?.id || viewer.isMod) ? (
          <ReplayEditButton
            replay={replay}
            providers={providers}
            byPanel={viewer.isMod && viewer.id !== replay.user?.id}
          />
        ) : null}
      </header>

      <div className="space-y-3 px-4 pt-3 pb-4">
        <h2 className="font-display text-3xl leading-none tracking-wide uppercase">{replay.slot_name}</h2>
        {replay.note ? <p className="text-muted">{replay.note}</p> : null}
        {stats.length ? (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg bg-surface-2 px-3 py-2">
                <dt className="text-xs text-subtle">{stat.label}</dt>
                <dd className={cn("num font-bold", stat.gold && "text-gold")}>{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <ReplayViewer
          url={replay.url}
          title={`${replay.slot_name} · ${name}`}
          embeddable={replay.provider?.embeddable ?? false}
          size="md"
          className="w-full"
        />
      </div>

      <div className="flex items-center gap-1 border-t border-line px-2 py-1.5">
        <button
          type="button"
          onClick={like}
          disabled={pending}
          aria-pressed={liked}
          aria-label={liked ? r.unlike : r.like}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-surface-2",
            liked ? "text-live" : "text-muted hover:text-text",
          )}
        >
          <Heart className={cn("size-5", liked && "fill-current")} aria-hidden />
          <span className="num">{formatInteger(likes)}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          aria-controls={`replay-${replay.id}-comments`}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <MessageCircle className="size-5" aria-hidden />
          <span className="num">{formatInteger(comments)}</span>
          <span className="sr-only">{r.comments}</span>
        </button>
        <button
          type="button"
          onClick={share}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Link2 className="size-5" aria-hidden />
          <span className="hidden sm:inline">{r.shareLink}</span>
          <span className="sr-only sm:hidden">{r.shareLink}</span>
        </button>
        <p aria-live="polite" className="ml-auto truncate px-2 text-xs text-subtle">
          {notice}
        </p>
      </div>

      {showComments ? (
        <ReplayComments
          id={`replay-${replay.id}-comments`}
          replayId={replay.id}
          viewer={viewer}
          onCountChange={(delta) => setComments((n) => Math.max(0, n + delta))}
        />
      ) : null}
    </article>
  );
}
