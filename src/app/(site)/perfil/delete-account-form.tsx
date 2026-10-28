"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useId } from "react";
import { buttonClasses } from "@/components/ui/button";
import { deleteAccount, type DeleteAccountState } from "./actions";

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(deleteAccount, {});
  const inputId = useId();

  return (
    <details className="rounded-2xl border border-line bg-surface p-5">
      <summary className="cursor-pointer text-sm font-semibold text-muted">Borrar mi cuenta</summary>
      <form action={formAction} className="mt-4 space-y-3">
        <p className="text-sm text-muted">
          Se borran tu perfil, tus puntos, tus verificaciones y tu historial de participación. No se puede deshacer.
        </p>
        <label htmlFor={inputId} className="block text-sm">
          Escribí <strong className="num">BORRAR</strong> para confirmar
        </label>
        <input
          id={inputId}
          name="confirm"
          autoComplete="off"
          className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-text sm:w-64"
        />
        {state.error ? (
          <p role="alert" className="text-sm text-live">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={buttonClasses({ variant: "live" })}>
          <Trash2 className="size-4" aria-hidden />
          {pending ? "Borrando…" : "Borrar mi cuenta"}
        </button>
      </form>
    </details>
  );
}
