"use client";

import { useActionState, useId } from "react";
import { FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { enterGiveaway } from "./actions";

export function EntryForm({
  giveawayId,
  mode,
  remaining,
  tickets,
}: {
  giveawayId: string;
  mode: "free" | "tickets";
  /** Tickets que todavía puede poner en este sorteo. */
  remaining: number;
  /** Tickets que tiene en total. */
  tickets: number;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(enterGiveaway, INITIAL_ACTION_STATE);
  const id = useId();
  const max = Math.min(remaining, tickets);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="giveaway_id" value={giveawayId} />
      <div className="flex flex-wrap items-center gap-2">
        {mode === "tickets" ? (
          <>
            <label htmlFor={id} className="text-xs text-subtle">
              Tickets
            </label>
            <input
              id={id}
              name="tickets"
              type="number"
              min={1}
              max={Math.max(max, 1)}
              defaultValue={1}
              disabled={max < 1}
              className={cn(inputClass, "num h-9 w-20")}
            />
          </>
        ) : null}
        <SubmitButton pendingLabel="Enviando…">{mode === "tickets" ? "Poner tickets" : "Participar"}</SubmitButton>
      </div>
      {mode === "tickets" && max < 1 ? (
        <p className="text-xs text-subtle">
          {remaining < 1 ? "Ya pusiste el máximo." : "No tenés tickets. Conseguilos en la tienda del Cuartel."}
        </p>
      ) : null}
      <FormMessage state={state} />
    </form>
  );
}
