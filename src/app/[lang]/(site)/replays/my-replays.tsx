"use client";

import { useI18n } from "@/i18n/client";
import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import { FormMessage } from "@/components/panel/form";
import { useConfirmSubmit } from "@/components/ui/confirm-dialog";
import { ReplayEditButton } from "@/components/replays/replay-edit-button";
import type { ReplayDraft } from "@/components/replays/replay-fields";
import { StatusPill } from "@/components/ui/status-pill";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { deleteMyReplay } from "./actions";

type Mine = ReplayDraft & { status: "pending" | "approved" | "rejected"; reject_reason: string | null };

const STATUS_TONE = { pending: "next", approved: "done", rejected: "muted" } as const;

/** Los replays que mandó el viewer y en qué quedó cada uno. */
export function MyReplays({ replays, providers }: { replays: Mine[]; providers: { name: string; domain: string }[] }) {
  const { t } = useI18n();
  if (!replays.length) return null;
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="mb-2 text-xs font-semibold text-subtle">{t.replays.yours}</h3>
      <ul className="space-y-2">
        {replays.map((replay) => (
          <li key={replay.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-semibold">{replay.slot_name}</span>
            <StatusPill label={t.replays.status[replay.status]} tone={STATUS_TONE[replay.status]} />
            <ReplayEditButton replay={replay} providers={providers} className="px-1.5 [&>span]:sr-only" />
            {replay.status === "pending" ? <DeleteButton id={replay.id} /> : null}
            {replay.status === "rejected" && replay.reject_reason ? (
              <p className="w-full text-xs text-subtle">{t.replays.reason(replay.reject_reason)}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deleteMyReplay, INITIAL_ACTION_STATE);
  const { t } = useI18n();
  const { onSubmit, dialog } = useConfirmSubmit({
    text: t.replays.deleteConfirm,
    confirmLabel: t.replays.deleteLabel,
    danger: true,
  });
  return (
    <form action={formAction} onSubmit={onSubmit} className="contents">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={t.replays.delete}
        className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-live"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
      {dialog}
      {state.error ? <FormMessage state={state} className="w-full" /> : null}
    </form>
  );
}
