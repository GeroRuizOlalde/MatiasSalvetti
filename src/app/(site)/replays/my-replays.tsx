"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import { FormMessage } from "@/components/panel/form";
import { confirmFromText, useConfirmSubmit } from "@/components/ui/confirm-dialog";
import { StatusPill } from "@/components/ui/status-pill";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { deleteMyReplay } from "./actions";

type Mine = {
  id: string;
  slot_name: string;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
};

const STATUS = {
  pending: { label: "En revisión", tone: "next" },
  approved: { label: "Publicado", tone: "done" },
  rejected: { label: "No publicado", tone: "muted" },
} as const;

/** Los replays que mandó el viewer y en qué quedó cada uno. */
export function MyReplays({ replays }: { replays: Mine[] }) {
  if (!replays.length) return null;
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="mb-2 text-xs font-semibold text-subtle">Tus replays</h3>
      <ul className="space-y-2">
        {replays.map((replay) => (
          <li key={replay.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-semibold">{replay.slot_name}</span>
            <StatusPill label={STATUS[replay.status].label} tone={STATUS[replay.status].tone} />
            {replay.status === "pending" ? <DeleteButton id={replay.id} /> : null}
            {replay.status === "rejected" && replay.reject_reason ? (
              <p className="w-full text-xs text-subtle">Motivo: {replay.reject_reason}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deleteMyReplay, INITIAL_ACTION_STATE);
  const { onSubmit, dialog } = useConfirmSubmit(confirmFromText("¿Borrar este replay? Todavía no se revisó."));
  return (
    <form action={formAction} onSubmit={onSubmit} className="contents">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label="Borrar replay"
        className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-live"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
      {dialog}
      {state.error ? <FormMessage state={state} className="w-full" /> : null}
    </form>
  );
}
