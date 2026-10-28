"use client";

import { useActionState, useId } from "react";
import { FormMessage, inputClass } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { reviewAccount } from "./actions";

export function ReviewForm({ accountId, status }: { accountId: string; status: "pending" | "approved" | "rejected" }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(reviewAccount, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={accountId} />
      {status !== "approved" ? (
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          className="h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-[#8a2cec] disabled:opacity-50"
        >
          Aprobar
        </button>
      ) : null}
      {status !== "rejected" ? (
        <>
          <label htmlFor={`${id}-reason`} className="sr-only">
            Motivo del rechazo
          </label>
          <input
            id={`${id}-reason`}
            name="reason"
            maxLength={200}
            placeholder="Motivo (si rechazás)"
            className={cn(inputClass, "h-9 w-56")}
          />
          <button
            type="submit"
            name="decision"
            value="reject"
            disabled={pending}
            className="h-9 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-live disabled:opacity-50"
          >
            Rechazar
          </button>
        </>
      ) : null}
      <FormMessage state={state} className="w-full" />
    </form>
  );
}
