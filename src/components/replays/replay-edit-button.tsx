"use client";

import { Pencil, X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { updateReplay } from "@/app/(site)/replays/actions";
import { FormMessage } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { ReplayFields, type ReplayDraft } from "./replay-fields";

/** Botón «Editar» que abre el formulario del replay en una ventana. */
export function ReplayEditButton({
  replay,
  providers,
  byPanel = false,
  className,
}: {
  replay: ReplayDraft;
  providers: { name: string; domain: string }[];
  /** Lo edita el panel: cambiar el link no lo manda a revisión. */
  byPanel?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRound((r) => r + 1);
          setOpen(true);
        }}
        aria-label="Editar replay"
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-text",
          className,
        )}
      >
        <Pencil className="size-4" aria-hidden />
        <span>Editar</span>
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-text shadow-2xl shadow-black/60 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <h2 id={titleId} className="flex-1 font-display text-2xl tracking-wide uppercase">
            Editar replay
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="rounded-md p-2 text-subtle hover:bg-surface-2 hover:text-text"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {open ? (
          // Cada vez que se abre arranca con los datos guardados y sin mensajes viejos.
          <EditBody
            key={round}
            replay={replay}
            providers={providers}
            byPanel={byPanel}
            onSaved={() => setTimeout(() => setOpen(false), 1800)}
          />
        ) : null}
      </dialog>
    </>
  );
}

function EditBody({
  replay,
  providers,
  byPanel,
  onSaved,
}: {
  replay: ReplayDraft;
  providers: { name: string; domain: string }[];
  byPanel: boolean;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await updateReplay(prev, data);
    if (result.ok) onSaved();
    return result;
  }, INITIAL_ACTION_STATE);

  return (
    <div className="space-y-3 p-5">
      <ReplayFields
        action={formAction}
        providers={providers}
        initial={replay}
        submitLabel="Guardar cambios"
        hint={byPanel ? undefined : "Si cambiás el link, el replay vuelve a revisión."}
      />
      <FormMessage state={state} />
    </div>
  );
}
