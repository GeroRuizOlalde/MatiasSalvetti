"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { markNotificationsRead } from "@/app/notifications/actions";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { NotificationItem, NotificationScope } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type Props = {
  scope: NotificationScope;
  items: NotificationItem[];
  readAt: string | null;
  /** Hacia dónde se abre el desplegable ("sidebar": a la derecha en compu, donde está la barra lateral). */
  align?: "left" | "right" | "sidebar";
};

/** Campanita con las últimas notificaciones. Se actualiza sola cuando llega una nueva. */
export function NotificationBell({ scope, items, readAt, align = "right" }: Props) {
  const [open, setOpen] = useState(false);
  // Al abrir se marcan leídas hasta la más nueva que se vio (con la hora del servidor, no la del navegador).
  const [seenUntil, setSeenUntil] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const menuId = useId();
  const lastRead =
    [readAt, seenUntil]
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? null;
  const count = items.filter((n) => !lastRead || n.created_at > lastRead).length;

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`notifications:${scope}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 400);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [scope, router]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && count > 0) {
      setSeenUntil(items[0].created_at);
      void markNotificationsRead(scope);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={count ? `Notificaciones, ${count} sin leer` : "Notificaciones"}
        className="relative flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
      >
        <Bell className="size-5" aria-hidden />
        {count ? (
          <span className="num absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-live px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={menuId}
          className={cn(
            "absolute z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface shadow-2xl shadow-black/50",
            align === "right" && "right-0",
            align === "left" && "left-0",
            align === "sidebar" && "right-0 lg:right-auto lg:left-0",
          )}
        >
          <p className="border-b border-line px-4 py-3 text-sm font-semibold">
            {scope === "panel" ? "Avisos del panel" : "Notificaciones"}
          </p>
          {items.length ? (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.map((item) => {
                const isNew = !readAt || item.created_at > readAt;
                const content = (
                  <>
                    <span
                      aria-hidden
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", isNew ? "bg-accent" : "bg-transparent")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.title}</span>
                      {item.body ? <span className="block text-sm text-muted">{item.body}</span> : null}
                      <span className="mt-0.5 block text-xs text-subtle">{formatDateTime(item.created_at)}</span>
                    </span>
                  </>
                );
                return (
                  <li key={item.id}>
                    {item.link ? (
                      <Link
                        href={item.link}
                        onClick={() => setOpen(false)}
                        className="flex gap-3 px-4 py-3 hover:bg-surface-2"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex gap-3 px-4 py-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-subtle">No tenés notificaciones todavía.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
