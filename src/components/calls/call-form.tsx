"use client";

import { useActionState, useId } from "react";
import { SlotPicker } from "@/components/hunts/slot-picker";
import { FormMessage, SubmitButton } from "@/components/panel/form";
import { useI18n } from "@/i18n/client";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  /** Campos ocultos con el id del hunt o de la sesión de buys. */
  hidden: Record<string, string>;
  /** "hunt" o "sesión", para el texto de la regla. */
  scopeLabel: string;
  taken: string[];
  /** Pregunta del formulario (en el hunt se busca el slot; en buys y battles se compra). */
  question?: string;
};

/** Pedir un slot. Una vez mandado no se cambia, y si el panel lo rechaza ya no se puede pedir otro. */
export function CallForm({ action, hidden, scopeLabel, taken, question }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, INITIAL_ACTION_STATE);
  const id = useId();
  const { t } = useI18n();

  return (
    <form action={formAction} className="space-y-2">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor={`${id}-slot`} className="block text-xs font-semibold text-subtle">
        {question ?? t.calls.buyQuestion}
      </label>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SlotPicker id={`${id}-slot`} required />
        </div>
        <SubmitButton pendingLabel={t.common.sending} className="h-10">
          {t.calls.request}
        </SubmitButton>
      </div>
      <p className="text-xs text-subtle">{t.calls.rule(scopeLabel)}</p>
      {taken.length ? (
        <p className="text-xs text-subtle">
          {t.calls.taken} <span className="text-muted">{taken.join(", ")}</span>
        </p>
      ) : null}
      <FormMessage state={state} />
    </form>
  );
}
