"use client";

import { Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { addReplayComment, deleteReplayComment, loadReplayComments } from "@/app/(site)/replays/actions";
import { inputClass } from "@/components/panel/form";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { ReplayComment } from "@/lib/replays";
import type { ReplayViewerUser } from "./replay-feed";

const MAX = 300;

/** Comentarios de una publicación: se cargan al abrirlos. */
export function ReplayComments({
  id,
  replayId,
  viewer,
  onCountChange,
}: {
  id: string;
  replayId: string;
  viewer: ReplayViewerUser | null;
  onCountChange: (delta: number) => void;
}) {
  const [comments, setComments] = useState<ReplayComment[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    loadReplayComments(replayId).then((list) => alive && setComments(list));
    return () => {
      alive = false;
    };
  }, [replayId]);

  const reload = async () => setComments(await loadReplayComments(replayId));

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const result = await addReplayComment(replayId, body);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setText("");
      onCountChange(1);
      await reload();
    });
  };

  const remove = (commentId: string) => {
    startTransition(async () => {
      const result = await deleteReplayComment(commentId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onCountChange(-1);
      await reload();
    });
  };

  return (
    <section id={id} aria-label="Comentarios" className="space-y-3 border-t border-line px-4 py-4">
      {comments === null ? (
        <p className="text-sm text-subtle">Cargando comentarios…</p>
      ) : comments.length ? (
        <ul className="space-y-3">
          {comments.map((comment) => {
            const name = comment.user?.name ?? "Viewer";
            const canDelete = viewer && (viewer.id === comment.userId || viewer.isMod);
            return (
              <li key={comment.id} className="flex gap-2">
                <Avatar url={comment.user?.avatarUrl ?? null} name={name} size={28} />
                <div className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-2">
                  <p className="text-xs">
                    <span className="font-semibold">{name}</span>{" "}
                    <span className="text-subtle">· {formatDateTime(comment.created_at)}</span>
                  </p>
                  <p className="text-sm break-words whitespace-pre-line">{comment.body}</p>
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => remove(comment.id)}
                    disabled={pending}
                    aria-label="Borrar comentario"
                    className="self-start rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-live disabled:opacity-50"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-subtle">Todavía no hay comentarios. ¡Sé el primero!</p>
      )}

      {viewer ? (
        <form onSubmit={send} className="flex gap-2">
          <label htmlFor={`${id}-input`} className="sr-only">
            Escribí un comentario
          </label>
          <input
            id={`${id}-input`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX}
            placeholder="Escribí un comentario…"
            className={cn(inputClass, "flex-1")}
          />
          <button
            type="submit"
            disabled={pending || !text.trim()}
            aria-label="Comentar"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white hover:bg-[#8a2cec] disabled:opacity-50"
          >
            <Send className="size-4" aria-hidden />
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted">
          <Link href="/entrar?next=/replays" className="font-semibold text-accent-text hover:underline">
            Entrá con Twitch
          </Link>{" "}
          para comentar.
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm text-live">
          {error}
        </p>
      ) : null}
    </section>
  );
}
