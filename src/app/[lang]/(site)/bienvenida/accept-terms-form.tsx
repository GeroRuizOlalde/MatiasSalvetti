"use client";

import { useI18n } from "@/i18n/client";
import Link from "next/link";
import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { acceptTerms, type AcceptTermsState } from "./actions";

export function AcceptTermsForm({ version, next }: { version: number; next: string }) {
  const [state, formAction, pending] = useActionState<AcceptTermsState, FormData>(acceptTerms, {});
  const { t, href } = useI18n();
  const a = t.auth;

  return (
    <form action={formAction} className="mt-8 space-y-4 text-left">
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="next" value={next} />

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4 hover:border-line-strong">
        <input type="checkbox" name="adult" required className="mt-1 size-5 shrink-0 accent-accent" />
        <span className="text-sm">
          {a.confirmAdult[0]}
          <strong>{a.confirmAdult[1]}</strong>
          {a.confirmAdult[2]}
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4 hover:border-line-strong">
        <input type="checkbox" name="terms" required className="mt-1 size-5 shrink-0 accent-accent" />
        <span className="text-sm">
          {a.acceptTerms[0]}
          <Link href={href("/bases-y-condiciones")} target="_blank" className="text-accent-text underline">
            {a.acceptTerms[1]}
          </Link>
          {a.acceptTerms[2]}
          <span className="num">{version}</span>
          {a.acceptTerms[3]}
          <Link href={href("/privacidad")} target="_blank" className="text-accent-text underline">
            {a.acceptTerms[4]}
          </Link>
          {a.acceptTerms[5]}
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-live/40 bg-live/10 px-4 py-3 text-sm">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={buttonClasses({ size: "lg", className: "w-full" })}>
        {pending ? a.saving : a.enter}
      </button>
    </form>
  );
}
