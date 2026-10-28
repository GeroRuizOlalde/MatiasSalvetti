"use client";

import { useActionState, useId, useRef } from "react";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { submitVerification } from "./verification-actions";

export function VerificationForm({
  casinos,
  defaultCasinoId,
}: {
  casinos: { id: string; name: string }[];
  defaultCasinoId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await submitVerification(prev, data);
    if (result.ok) formRef.current?.reset();
    return result;
  }, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <Field id={`${id}-casino`} label="Casino">
        <select id={`${id}-casino`} name="casino_id" required defaultValue={defaultCasinoId} className={inputClass}>
          {casinos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${id}-account`} label="ID de tu cuenta en el casino" hint="Lo encontrás en tu perfil del casino.">
        <input
          id={`${id}-account`}
          name="account_id"
          required
          minLength={3}
          maxLength={64}
          pattern="[A-Za-z0-9._@\-]{3,64}"
          autoComplete="off"
          className={inputClass}
        />
      </Field>
      <Field
        id={`${id}-shot`}
        label="Captura de pantalla"
        hint="Donde se vea el ID y tu usuario. PNG, JPG o WebP, hasta 5 MB. Solo la ve el admin."
      >
        <input
          id={`${id}-shot`}
          name="screenshot"
          type="file"
          required
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-text"
        />
      </Field>
      <SubmitButton pendingLabel="Enviando…">Enviar verificación</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
