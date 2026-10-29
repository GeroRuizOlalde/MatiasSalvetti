"use client";

import { useActionState, useId } from "react";
import { SlotPicker } from "@/components/hunts/slot-picker";
import { FormMessage, SubmitButton } from "@/components/panel/form";
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
export function CallForm({ action, hidden, scopeLabel, taken, question = "¿Qué slot querés que compre?" }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="space-y-2">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor={`${id}-slot`} className="block text-xs font-semibold text-subtle">
        {question}
      </label>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SlotPicker id={`${id}-slot`} required />
        </div>
        <SubmitButton pendingLabel="Enviando…" className="h-10">
          Pedir
        </SubmitButton>
      </div>
      <p className="text-xs text-subtle">
        Una máquina por {scopeLabel}. El call no se puede cambiar y, si se rechaza, no podés pedir otro: elegí bien.
      </p>
      {taken.length ? (
        <p className="text-xs text-subtle">
          Ya pedidas: <span className="text-muted">{taken.join(", ")}</span>
        </p>
      ) : null}
      <FormMessage state={state} />
    </form>
  );
}
