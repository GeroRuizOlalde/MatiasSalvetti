"use client";

import { useActionState, useId, useRef } from "react";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { saveSlot } from "./actions";

type Slot = { id: string; name: string; provider: string | null; is_active: boolean; image_path: string | null };

export function SlotForm({ slot }: { slot?: Slot }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await saveSlot(prev, data);
    if (result.ok && !slot) formRef.current?.reset();
    return result;
  }, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-[2fr_1.5fr_1.5fr_auto] sm:items-end">
      {slot ? <input type="hidden" name="id" value={slot.id} /> : null}
      <Field id={`${id}-name`} label="Nombre">
        <input
          id={`${id}-name`}
          name="name"
          required
          maxLength={120}
          defaultValue={slot?.name}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-provider`} label="Proveedor">
        <input
          id={`${id}-provider`}
          name="provider"
          maxLength={80}
          defaultValue={slot?.provider ?? ""}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-image`} label="Imagen (opcional, solo con permiso)">
        <input
          id={`${id}-image`}
          name="image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-text"
        />
      </Field>
      <div className="flex items-center gap-3 sm:pb-0.5">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={slot?.is_active ?? true}
            className="size-4 accent-accent"
          />
          Activo
        </label>
        <SubmitButton>{slot ? "Guardar" : "Agregar"}</SubmitButton>
      </div>
      {slot?.image_path ? (
        <label className="flex items-center gap-2 text-xs text-muted sm:col-span-4">
          <input type="checkbox" name="remove_image" className="size-4 accent-accent" />
          Quitar la imagen actual
        </label>
      ) : null}
      <FormMessage state={state} className="sm:col-span-4" />
    </form>
  );
}
