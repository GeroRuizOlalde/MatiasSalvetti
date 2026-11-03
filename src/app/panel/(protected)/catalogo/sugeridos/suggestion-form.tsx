"use client";

import { useActionState, useId } from "react";
import { Field, FormMessage, inputClass } from "@/components/panel/form";
import { buttonClasses } from "@/components/ui/button";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { reviewSlotSuggestion } from "../actions";

/** Corregir el nombre, agregar el proveedor y sumarlo al catálogo (o descartarlo). */
export function SuggestionForm({
  suggestion,
  providersListId,
}: {
  suggestion: { id: string; name: string; provider: string | null };
  /** <datalist> con los proveedores del catálogo, para elegir sin escribir. */
  providersListId: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reviewSlotSuggestion,
    INITIAL_ACTION_STATE,
  );
  const id = useId();

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[2fr_1.5fr_auto] sm:items-end">
      <input type="hidden" name="id" value={suggestion.id} />
      <Field id={`${id}-name`} label="Nombre">
        <input
          id={`${id}-name`}
          name="name"
          required
          maxLength={120}
          defaultValue={suggestion.name}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-provider`} label="Proveedor">
        <input
          id={`${id}-provider`}
          name="provider"
          maxLength={80}
          list={providersListId}
          defaultValue={suggestion.provider ?? ""}
          placeholder="Ej.: Pragmatic Play"
          className={inputClass}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="add"
          disabled={pending}
          className={buttonClasses({ size: "sm", className: "h-10" })}
        >
          Agregar al catálogo
        </button>
        <button
          type="submit"
          name="decision"
          value="save"
          disabled={pending}
          className={buttonClasses({ variant: "secondary", size: "sm", className: "h-10" })}
        >
          Guardar
        </button>
        <button
          type="submit"
          name="decision"
          value="dismiss"
          formNoValidate
          disabled={pending}
          className={buttonClasses({ variant: "ghost", size: "sm", className: "h-10 hover:text-live" })}
        >
          Descartar
        </button>
      </div>
      <FormMessage state={state} className="sm:col-span-3" />
    </form>
  );
}
