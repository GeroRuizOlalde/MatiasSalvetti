"use client";

import { useActionState, type ReactNode } from "react";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { FormMessage, SubmitButton } from "./form";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Un botón que dispara una Server Action con campos ocultos (y confirmación opcional). */
export function ActionButton({
  action,
  fields,
  children,
  pendingLabel = "Guardando…",
  confirmText,
  variant = "secondary",
  className,
}: {
  action: Action;
  fields: Record<string, string>;
  children: ReactNode;
  pendingLabel?: string;
  confirmText?: string;
  variant?: "primary" | "secondary" | "ghost" | "live";
  className?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, INITIAL_ACTION_STATE);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
      className={cn("flex flex-wrap items-center gap-3", className)}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} pendingLabel={pendingLabel}>
        {children}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
