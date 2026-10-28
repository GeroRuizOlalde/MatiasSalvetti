"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { SlotPicker } from "@/components/hunts/slot-picker";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { formatMulti } from "@/lib/format";
import { addBonus, deleteBonus, reviewCall, updateBonus } from "../actions";
import { AmountInput } from "@/components/ui/amount-input";
import { confirmFromText, useConfirmSubmit } from "@/components/ui/confirm-dialog";

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
        <AmountInput id={`${id}-bet`} name="bet" required defaultValue={defaultBet} className={moneyInput} />
      </Field>
      <Field id={`${id}-payout`} label="Pago (si ya se abrió)">
        <AmountInput id={`${id}-payout`} name="payout" className={moneyInput} />
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
  const confirmDelete = useConfirmSubmit(confirmFromText("¿Borrar este bono?"));
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
        <AmountInput
          id={`${id}-bet`}
          name="bet"
          required
          disabled={locked}
          value={bet}
          onValueChange={setBet}
          className={cn(moneyInput, "h-9 w-28")}
        />
        <label htmlFor={`${id}-payout`} className="sr-only">
          Pago
        </label>
        <AmountInput
          id={`${id}-payout`}
          name="payout"
          placeholder="Pago"
          disabled={locked}
          value={payout}
          onValueChange={setPayout}
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
        <form action={deleteAction} onSubmit={confirmDelete.onSubmit}>
          {confirmDelete.dialog}
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
}: {
  huntId: string;
  callId: string;
  defaultBet?: number;
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
      <AmountInput
        id={`${id}-bet`}
        name="bet"
        placeholder="Apuesta"
        defaultValue={defaultBet}
        className={cn(moneyInput, "h-9 w-28")}
      />
      <button
        type="submit"
        name="decision"
        value="accept"
        className="h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-[#8a2cec]"
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
