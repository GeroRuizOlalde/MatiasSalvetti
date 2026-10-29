"use client";

import { Clapperboard } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { formatDate, formatMulti } from "@/lib/format";
import { ReplayViewer } from "./replay-viewer";

export type ReplayCard = {
  id: string;
  url: string;
  slot_name: string;
  multi: number | null;
  note: string | null;
  created_at: string;
  provider: { name: string; embeddable: boolean } | null;
  user: { name: string; avatarUrl: string | null } | null;
};

const SORTS = [
  { value: "new", label: "Más nuevos" },
  { value: "multi", label: "Mayor multi" },
] as const;

/** Grilla de replays con filtro por proveedor y orden. */
export function ReplayGrid({ replays }: { replays: ReplayCard[] }) {
  const [provider, setProvider] = useState<string | null>(null);
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("new");

  const providers = [...new Set(replays.map((r) => r.provider?.name ?? "Otros"))].sort();
  const shown = replays
    .filter((r) => !provider || (r.provider?.name ?? "Otros") === provider)
    .sort((a, b) =>
      sort === "multi" ? (b.multi ?? 0) - (a.multi ?? 0) || b.created_at.localeCompare(a.created_at) : 0,
    );

  if (!replays.length) {
    return (
      <EmptyState icon={Clapperboard} title="Todavía no hay replays">
        Compartí el primero: pegá el link del replay de tu mejor bono.
      </EmptyState>
    );
  }

  const chip = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1 text-sm font-semibold transition-colors",
      active ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-text",
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {providers.length > 1 ? (
          <div role="group" aria-label="Proveedor" className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={!provider}
              onClick={() => setProvider(null)}
              className={chip(!provider)}
            >
              Todos
            </button>
            {providers.map((name) => (
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
          Ordenar
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-text"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {shown.map((replay) => (
          <li key={replay.id}>
            <article className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-subtle uppercase">
                    {replay.provider?.name ?? "Replay"}
                  </p>
                  <h2 className="truncate font-display text-2xl tracking-wide uppercase">{replay.slot_name}</h2>
                </div>
                {replay.multi !== null ? (
                  <span className="num shrink-0 rounded-full bg-gold/15 px-2.5 py-0.5 text-sm font-bold text-gold">
                    {formatMulti(replay.multi)}
                  </span>
                ) : null}
              </div>
              {replay.note ? <p className="text-sm text-muted">{replay.note}</p> : null}
              <div className="mt-auto flex items-center gap-3 pt-2">
                {replay.user ? <Avatar url={replay.user.avatarUrl} name={replay.user.name} size={28} /> : null}
                <div className="min-w-0 flex-1">
                  {replay.user ? <p className="truncate text-sm font-semibold">{replay.user.name}</p> : null}
                  <p className="text-xs text-subtle">{formatDate(replay.created_at)}</p>
                </div>
                <ReplayViewer
                  url={replay.url}
                  title={`${replay.slot_name}${replay.user ? ` · ${replay.user.name}` : ""}`}
                  embeddable={replay.provider?.embeddable ?? false}
                />
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
