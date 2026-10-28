"use client";

import { useActionState, useId } from "react";
import { FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { submitGuess } from "../actions";
import { AmountInput } from "@/components/ui/amount-input";

export function GuessForm({
  huntId,
  currentGuess,
  currencyPrefix,
}: {
  huntId: string;
  currentGuess: number | null;
  currencyPrefix: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(submitGuess, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="hunt_id" value={huntId} />
      <label htmlFor={`${id}-amount`} className="block text-xs font-semibold text-subtle">
        {currentGuess !== null ? "Cambiar mi apuesta" : "¿Con cuánto termina el hunt?"}
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-subtle"
          >
            {currencyPrefix}
          </span>
          <AmountInput
            id={`${id}-amount`}
            name="amount"
            required
            defaultValue={currentGuess ?? undefined}
            className={cn(inputClass, "num pl-12")}
          />
        </div>
        <SubmitButton pendingLabel="Enviando…" className="h-10">
          {currentGuess !== null ? "Cambiar" : "Apostar"}
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
