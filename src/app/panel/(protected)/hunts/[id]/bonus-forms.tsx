"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { SlotPicker } from "@/components/hunts/slot-picker";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { formatMulti } from "@/lib/format";
import { addBonus, deleteBonus, reviewCall, updateBonus } from "../actions";

const moneyInput = cn(inputClass, "num");

export function AddBonusForm({ huntId, defaultBet }: { huntId: string; defaultBet?: number }) {
  // Remontar el picker después de cada alta lo deja vacío.
  const [round, setRound] = useState(0);
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await addBonus(prev, data);
    if (result.ok) setRound((r) => r + 1);
    return result;
  }, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-start">
      <input type="hidden" name="hunt_id" value={huntId} />
      <Field id={`${id}-slot`} label="Slot" hint="Si no está en el catálogo, se agrega.">
        <SlotPicker key={round} id={`${id}-slot`} required />
      </Field>
      <Field id={`${id}-bet`} label="Apuesta">
        <input
          id={`${id}-bet`}
          name="bet"
          type="number"
          inputMode="decimal"
          min={0.01}
          step="0.01"
          required
          defaultValue={defaultBet}
          className={moneyInput}
        />
      </Field>
      <Field id={`${id}-payout`} label="Pago (si ya se abrió)">
        <input
          id={`${id}-payout`}
          name="payout"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          className={moneyInput}
        />
      </Field>
      <SubmitButton className="h-10 sm:mt-5">Agregar</SubmitButton>
      <FormMessage state={state} className="sm:col-span-4" />
    </form>
  );
}

type Bonus = { id: string; bet: number; payout: number | null };

/** Fila editable: apuesta y pago. Con el pago cargado, el bono queda abierto. */
export function BonusRowForm({ huntId, bonus, locked }: { huntId: string; bonus: Bonus; locked: boolean }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateBonus, INITIAL_ACTION_STATE);
  const [deleteState, deleteAction] = useActionState<ActionState, FormData>(deleteBonus, INITIAL_ACTION_STATE);
  const [payout, setPayout] = useState(bonus.payout === null ? "" : String(bonus.payout));
  const [bet, setBet] = useState(String(bonus.bet));
  const preview = payout !== "" && Number(bet) > 0 ? Number(payout) / Number(bet) : null;
  const id = useId();
  const message = deleteState.error ? deleteState : state;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={bonus.id} />
        <input type="hidden" name="hunt_id" value={huntId} />
        <label htmlFor={`${id}-bet`} className="sr-only">
          Apuesta
        </label>
        <input
          id={`${id}-bet`}
          name="bet"
          type="number"
          inputMode="decimal"
          min={0.01}
          step="0.01"
          required
          disabled={locked}
          value={bet}
          onChange={(e) => setBet(e.target.value)}
          className={cn(moneyInput, "h-9 w-28")}
        />
        <label htmlFor={`${id}-payout`} className="sr-only">
          Pago
        </label>
        <input
          id={`${id}-payout`}
          name="payout"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="Pago"
          disabled={locked}
          value={payout}
          onChange={(e) => setPayout(e.target.value)}
          className={cn(moneyInput, "h-9 w-32")}
        />
        <span className="num w-20 text-right text-sm text-gold">{preview !== null ? formatMulti(preview) : "—"}</span>
        {locked ? null : (
          <SubmitButton variant="secondary" pendingLabel="…">
            {bonus.payout === null ? "Abrir" : "Guardar"}
          </SubmitButton>
        )}
      </form>
      {locked ? null : (
        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!confirm("¿Borrar este bono?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={bonus.id} />
          <input type="hidden" name="hunt_id" value={huntId} />
          <button
            type="submit"
            className="rounded-md p-2 text-subtle hover:bg-surface-2 hover:text-live"
            aria-label="Borrar bono"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </form>
      )}
      {message.error ? <FormMessage state={{ error: message.error }} className="w-full" /> : null}
    </div>
  );
}

export function CallReviewForm({
  huntId,
  callId,
  defaultBet,
  tipeo,
}: {
  huntId: string;
  callId: string;
  defaultBet?: number;
  /** El slot ya pagó más de 110x: se ofrece aceptarlo como tipeo. */
  tipeo?: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(reviewCall, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={callId} />
      <input type="hidden" name="hunt_id" value={huntId} />
      <label htmlFor={`${id}-bet`} className="sr-only">
        Apuesta
      </label>
      <input
        id={`${id}-bet`}
        name="bet"
        type="number"
        inputMode="decimal"
        min={0.01}
        step="0.01"
        placeholder="Apuesta"
        defaultValue={defaultBet}
        className={cn(moneyInput, "h-9 w-28")}
      />
      {tipeo ? (
        <button
          type="submit"
          name="decision"
          value="tipeo"
          className="h-9 rounded-lg bg-gold px-3 text-sm font-semibold text-bg hover:brightness-110"
        >
          Aceptar tipeo
        </button>
      ) : null}
      <button
        type="submit"
        name="decision"
        value="accept"
        className={cn(
          "h-9 rounded-lg px-3 text-sm font-semibold",
          tipeo ? "border border-line text-text hover:bg-surface-2" : "bg-accent text-white hover:bg-[#8a2cec]",
        )}
      >
        Aceptar
      </button>
      <button
        type="submit"
        name="decision"
        value="reject"
        formNoValidate
        className="h-9 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-live"
      >
        Rechazar
      </button>
      <FormMessage state={state} className="w-full" />
    </form>
  );
}
