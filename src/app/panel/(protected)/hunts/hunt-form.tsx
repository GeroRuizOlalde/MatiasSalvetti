"use client";

import { useActionState, useId } from "react";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { HUNT_STATUSES, type HuntStatus } from "@/lib/hunt-status";
import type { Enums } from "@/types/database";
import { deleteHunt, saveHunt } from "./actions";
import { AmountInput } from "@/components/ui/amount-input";

type Hunt = {
  id: string;
  title: string;
  casino_id: string | null;
  currency: Enums<"currency_code">;
  start_cost: number;
  status: HuntStatus;
  calls_open: boolean;
  guesses_open: boolean;
};

export function HuntForm({ hunt, casinos }: { hunt?: Hunt; casinos: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveHunt, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {hunt ? <input type="hidden" name="id" value={hunt.id} /> : null}
      <Field id={`${id}-title`} label="Título" className="sm:col-span-2">
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={80}
          defaultValue={hunt?.title}
          placeholder="Hunt del viernes"
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-casino`} label="Casino">
        <select id={`${id}-casino`} name="casino_id" defaultValue={hunt?.casino_id ?? ""} className={inputClass}>
          <option value="">Sin casino</option>
          {casinos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Field id={`${id}-start`} label="Inversión inicial">
          <AmountInput
            id={`${id}-start`}
            name="start_cost"
            required
            defaultValue={hunt?.start_cost}
            className={inputClass}
          />
        </Field>
        <Field id={`${id}-currency`} label="Moneda">
          <select id={`${id}-currency`} name="currency" defaultValue={hunt?.currency ?? "ARS"} className={inputClass}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </Field>
      </div>

      {hunt ? (
        <>
          <Field
            id={`${id}-status`}
            label="Estado"
            hint={HUNT_STATUSES.find((s) => s.value === hunt.status)?.hint}
            className="sm:col-span-2"
          >
            <select id={`${id}-status`} name="status" defaultValue={hunt.status} className={inputClass}>
              {HUNT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <legend className="sr-only">Participación</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="calls_open"
                defaultChecked={hunt.calls_open}
                className="size-4 accent-accent"
              />
              Calls abiertos
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="guesses_open"
                defaultChecked={hunt.guesses_open}
                className="size-4 accent-accent"
              />
              Adiviná el balance abierto
            </label>
          </fieldset>
        </>
      ) : (
        <input type="hidden" name="status" value="draft" />
      )}

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <SubmitButton>{hunt ? "Guardar" : "Crear hunt"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function DeleteHuntForm({ huntId }: { huntId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deleteHunt, INITIAL_ACTION_STATE);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("¿Borrar el hunt con todos sus bonos, calls y apuestas? No se puede deshacer."))
          e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="id" value={huntId} />
      <SubmitButton variant="ghost" pendingLabel="Borrando…" className="text-live">
        Borrar hunt
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
