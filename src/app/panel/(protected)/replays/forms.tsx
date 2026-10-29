"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useId } from "react";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { buttonClasses } from "@/components/ui/button";
import { useConfirmSubmit } from "@/components/ui/confirm-dialog";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { addProvider, reviewReplay, updateProvider } from "./actions";

/** Publicar, rechazar (con motivo) o borrar un replay. */
export function ReplayReviewForm({
  replayId,
  status,
}: {
  replayId: string;
  status: "pending" | "approved" | "rejected";
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(reviewReplay, INITIAL_ACTION_STATE);
  const id = useId();
  const { onSubmit, dialog } = useConfirmSubmit(
    { text: "¿Borrar este replay? Se saca de la web y no se puede deshacer.", confirmLabel: "Borrar", danger: true },
    (submitter) => submitter?.getAttribute("value") === "delete",
  );

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={replayId} />
      {status !== "approved" ? (
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          className={buttonClasses({ size: "sm" })}
        >
          Publicar
        </button>
      ) : null}
      {status !== "rejected" ? (
        <>
          <label htmlFor={`${id}-reason`} className="sr-only">
            Motivo del rechazo
          </label>
          <input
            id={`${id}-reason`}
            name="reason"
            maxLength={200}
            placeholder="Motivo (si rechazás)"
            className={cn(inputClass, "h-9 w-56")}
          />
          <button
            type="submit"
            name="decision"
            value="reject"
            disabled={pending}
            className={buttonClasses({ variant: "ghost", size: "sm", className: "hover:text-live" })}
          >
            Rechazar
          </button>
        </>
      ) : null}
      <button
        type="submit"
        name="decision"
        value="delete"
        disabled={pending}
        aria-label="Borrar replay"
        className="rounded-md p-2 text-subtle hover:bg-surface-2 hover:text-live disabled:opacity-50"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
      {dialog}
      <FormMessage state={state} className="w-full" />
    </form>
  );
}

export function AddProviderForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(addProvider, INITIAL_ACTION_STATE);
  const id = useId();
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field id={`${id}-name`} label="Proveedor">
        <input id={`${id}-name`} name="name" required maxLength={60} placeholder="Hacksaw" className={inputClass} />
      </Field>
      <Field id={`${id}-domain`} label="Dominio de los links">
        <input
          id={`${id}-domain`}
          name="domain"
          required
          placeholder="hacksawgaming.com (o pegá un link)"
          className={inputClass}
        />
      </Field>
      <SubmitButton className="h-10">Agregar</SubmitButton>
      <FormMessage state={state} className="sm:col-span-3" />
    </form>
  );
}

/** Activar «se ve en la página» o borrar un proveedor. */
export function ProviderActions({ providerId, embeddable }: { providerId: string; embeddable: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateProvider, INITIAL_ACTION_STATE);
  const { onSubmit, dialog } = useConfirmSubmit(
    {
      text: "¿Borrar este proveedor? Sus replays quedan, pero se abren en otra pestaña y figuran como proveedor desconocido.",
      confirmLabel: "Borrar",
      danger: true,
    },
    (submitter) => submitter?.getAttribute("value") === "delete",
  );
  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={providerId} />
      <button
        type="submit"
        name="action"
        value={embeddable ? "embed_off" : "embed_on"}
        disabled={pending}
        aria-pressed={embeddable}
        className={buttonClasses({ variant: embeddable ? "primary" : "secondary", size: "sm" })}
      >
        {embeddable ? "Se ve en la página" : "Se abre en otra pestaña"}
      </button>
      <button
        type="submit"
        name="action"
        value="delete"
        disabled={pending}
        aria-label="Borrar proveedor"
        className="rounded-md p-2 text-subtle hover:bg-surface-2 hover:text-live disabled:opacity-50"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
      {dialog}
      {state.error ? <FormMessage state={state} className="w-full" /> : null}
    </form>
  );
}
