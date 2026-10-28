"use client";

import { useActionState, type ReactNode } from "react";
import { confirmFromText, useConfirmSubmit } from "@/components/ui/confirm-dialog";
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
  const confirm = useConfirmSubmit(confirmText ? confirmFromText(confirmText) : null);
  return (
    <form
      action={formAction}
      onSubmit={confirm.onSubmit}
      className={cn("flex flex-wrap items-center gap-3", className)}
    >
      {confirm.dialog}
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
