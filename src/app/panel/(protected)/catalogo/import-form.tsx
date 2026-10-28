"use client";

import { useActionState, useId } from "react";
import { FormMessage, SubmitButton } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { importFromSlotReport, importSlots } from "./actions";

export function ImportSlotsForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(importSlots, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-muted">
        Un CSV con dos columnas: <span className="num">nombre</span> y <span className="num">proveedor</span> (la
        primera fila puede ser el encabezado). Separado por coma o punto y coma. Los que ya existen se saltean.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={id} className="sr-only">
          Archivo CSV de slots
        </label>
        <input
          id={id}
          name="file"
          type="file"
          accept=".csv,text/csv,text/plain"
          required
          className="text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-text"
        />
        <SubmitButton variant="secondary" pendingLabel="Importando…">
          Importar
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function SlotReportImport() {
  const [state, formAction] = useActionState<ActionState, FormData>(importFromSlotReport, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-muted">
        Carga de una vez los nombres y proveedores de miles de slots desde{" "}
        <a href="https://slot.report" target="_blank" rel="noopener" className="text-accent-text underline">
          slot.report
        </a>
        . No trae imágenes. Se puede repetir para sumar los nuevos: los que ya están se saltean.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="secondary" pendingLabel="Importando… (puede tardar)">
          Importar desde slot.report
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
