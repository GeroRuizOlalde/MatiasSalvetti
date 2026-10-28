"use client";

import { useActionState, useId } from "react";
import { FormMessage, SubmitButton } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Lista de opciones con radio (votar, bancar a un slot). Manda `name` con el id elegido. */
export function ChoiceForm({
  action,
  name,
  options,
  current,
  submitLabel,
  changeLabel,
  hidden = {},
}: {
  action: Action;
  name: string;
  options: { id: string; label: string; detail?: string }[];
  current: string | null;
  submitLabel: string;
  changeLabel: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="space-y-3">
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <fieldset className="space-y-2">
        <legend className="sr-only">Opciones</legend>
        {options.map((option) => (
          <label
            key={option.id}
            htmlFor={`${id}-${option.id}`}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm",
              "has-checked:border-accent has-checked:bg-accent/10",
            )}
          >
            <input
              id={`${id}-${option.id}`}
              type="radio"
              name={name}
              value={option.id}
              required
              defaultChecked={option.id === current}
              className="size-4 accent-accent"
            />
            <span className="min-w-0 flex-1 truncate font-semibold">{option.label}</span>
            {option.detail ? <span className="text-xs text-subtle">{option.detail}</span> : null}
          </label>
        ))}
      </fieldset>
      <SubmitButton pendingLabel="Enviando…">{current ? changeLabel : submitLabel}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
