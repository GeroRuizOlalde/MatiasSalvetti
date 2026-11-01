"use client";

import { useI18n } from "@/i18n/client";
import { Trash2 } from "lucide-react";
import { useActionState, useId } from "react";
import { buttonClasses } from "@/components/ui/button";
import { deleteAccount, type DeleteAccountState } from "./actions";

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(deleteAccount, {});
  const inputId = useId();
  const { t } = useI18n();
  const p = t.profile;

  return (
    <details className="rounded-2xl border border-line bg-surface p-5">
      <summary className="cursor-pointer text-sm font-semibold text-muted">{p.deleteAccount}</summary>
      <form action={formAction} className="mt-4 space-y-3">
        <p className="text-sm text-muted">{p.deleteText}</p>
        <label htmlFor={inputId} className="block text-sm">
          {p.typeToConfirm[0]}
          <strong className="num">{t.actions.deleteAccount.word}</strong>
          {p.typeToConfirm[1]}
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
          {pending ? p.deleting : p.deleteAccount}
        </button>
      </form>
    </details>
  );
}
