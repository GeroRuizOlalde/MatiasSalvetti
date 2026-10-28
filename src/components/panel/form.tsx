"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClasses } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

export const inputClass =
  "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-text placeholder:text-subtle disabled:opacity-60";

export const textareaClass =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-subtle";

export function Field({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-subtle">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Guardando…",
  variant = "primary",
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "live";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses({ variant, size: "sm", className })}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  return (
    <p aria-live="polite" className={cn("text-sm", className)}>
      {state.error ? <span className="text-live">{state.error}</span> : null}
      {state.ok ? <span className="text-accent-text">{state.ok}</span> : null}
    </p>
  );
}
