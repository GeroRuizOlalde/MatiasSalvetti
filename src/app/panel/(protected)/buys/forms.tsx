"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { SlotPicker } from "@/components/hunts/slot-picker";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { SessionFields } from "@/components/panel/session-fields";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { formatMoney, formatMulti } from "@/lib/format";
import { BUY_STATUSES } from "@/lib/session-status";
import type { Enums } from "@/types/database";
import { addBuy, deleteBuy, reviewBuyCall, saveBuySession, updateBuy } from "./actions";

const moneyInput = cn(inputClass, "num");

type Session = {
  id: string;
  title: string;
  casino_id: string | null;
  currency: Enums<"currency_code">;
  status: Enums<"buy_session_status">;
  calls_open: boolean;
};

export function BuySessionForm({ session, casinos }: { session?: Session; casinos: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveBuySession, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {session ? <input type="hidden" name="id" value={session.id} /> : null}
      <SessionFields
        id={id}
        title={session?.title}
        casinoId={session?.casino_id}
        currency={session?.currency}
        casinos={casinos}
        placeholder="Buys del sábado"
      />
      {session ? (
        <Field
          id={`${id}-status`}
          label="Estado"
          hint={BUY_STATUSES.find((s) => s.value === session.status)?.hint}
          className="sm:col-span-2"
        >
          <select id={`${id}-status`} name="status" defaultValue={session.status} className={inputClass}>
            {BUY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="status" value="draft" />
      )}
      {session ? (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="calls_open"
            defaultChecked={session.calls_open}
            className="size-4 accent-accent"
          />
          Calls abiertos (con la sesión «En vivo»)
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <SubmitButton>{session ? "Guardar" : "Crear sesión"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function AddBuyForm({ sessionId, defaults }: { sessionId: string; defaults?: { bet: number; cost: number } }) {
  const [round, setRound] = useState(0);
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await addBuy(prev, data);
    if (result.ok) setRound((r) => r + 1);
    return result;
  }, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-start">
      <input type="hidden" name="session_id" value={sessionId} />
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
          defaultValue={defaults?.bet}
          className={moneyInput}
        />
      </Field>
      <Field id={`${id}-cost`} label="Costo de la compra">
        <input
          id={`${id}-cost`}
          name="cost"
          type="number"
          inputMode="decimal"
          min={0.01}
          step="0.01"
          required
          defaultValue={defaults?.cost}
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
      <FormMessage state={state} className="sm:col-span-5" />
    </form>
  );
}

type Buy = { id: string; bet: number; cost: number; payout: number | null };

export function BuyRowForm({
  sessionId,
  buy,
  currency,
  locked,
}: {
  sessionId: string;
  buy: Buy;
  currency: Enums<"currency_code">;
  locked: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateBuy, INITIAL_ACTION_STATE);
  const [deleteState, deleteAction] = useActionState<ActionState, FormData>(deleteBuy, INITIAL_ACTION_STATE);
  const [values, setValues] = useState({
    bet: String(buy.bet),
    cost: String(buy.cost),
    payout: buy.payout === null ? "" : String(buy.payout),
  });
  const bet = Number(values.bet);
  const multi = values.payout !== "" && bet > 0 ? Number(values.payout) / bet : null;
  const profit = values.payout !== "" ? Number(values.payout) - Number(values.cost) : null;
  const id = useId();
  const message = deleteState.error ? deleteState : state;

  const input = (name: keyof typeof values, label: string, width: string, min: number) => (
    <>
      <label htmlFor={`${id}-${name}`} className="sr-only">
        {label}
      </label>
      <input
        id={`${id}-${name}`}
        name={name}
        type="number"
        inputMode="decimal"
        min={min}
        step="0.01"
        required={name !== "payout"}
        placeholder={label}
        disabled={locked}
        value={values[name]}
        onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
        className={cn(moneyInput, "h-9", width)}
      />
    </>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={buy.id} />
        <input type="hidden" name="session_id" value={sessionId} />
        {input("bet", "Apuesta", "w-24", 0.01)}
        {input("cost", "Costo", "w-28", 0.01)}
        {input("payout", "Pago", "w-28", 0)}
        <span className="num w-20 text-right text-sm text-gold">{multi !== null ? formatMulti(multi) : "—"}</span>
        <span
          className={cn(
            "num w-28 text-right text-sm",
            profit === null ? "text-subtle" : profit >= 0 ? "text-emerald-400" : "text-live",
          )}
        >
          {profit !== null ? formatMoney(profit, currency) : "—"}
        </span>
        {locked ? null : (
          <SubmitButton variant="secondary" pendingLabel="…">
            {buy.payout === null ? "Abrir" : "Guardar"}
          </SubmitButton>
        )}
      </form>
      {locked ? null : (
        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!confirm("¿Borrar esta compra?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={buy.id} />
          <input type="hidden" name="session_id" value={sessionId} />
          <button
            type="submit"
            className="rounded-md p-2 text-subtle hover:bg-surface-2 hover:text-live"
            aria-label="Borrar compra"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </form>
      )}
      {message.error ? <FormMessage state={{ error: message.error }} className="w-full" /> : null}
    </div>
  );
}

/** Aceptar un call de buys: la apuesta y el costo de la compra vienen de la última, para no tipear de más. */
export function BuyCallReviewForm({
  sessionId,
  callId,
  defaults,
}: {
  sessionId: string;
  callId: string;
  defaults?: { bet: number; cost: number };
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(reviewBuyCall, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={callId} />
      <input type="hidden" name="session_id" value={sessionId} />
      {(["bet", "cost"] as const).map((name) => (
        <span key={name}>
          <label htmlFor={`${id}-${name}`} className="sr-only">
            {name === "bet" ? "Apuesta" : "Costo de la compra"}
          </label>
          <input
            id={`${id}-${name}`}
            name={name}
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            placeholder={name === "bet" ? "Apuesta" : "Costo"}
            defaultValue={defaults?.[name]}
            className={cn(moneyInput, "h-9 w-28")}
          />
        </span>
      ))}
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
