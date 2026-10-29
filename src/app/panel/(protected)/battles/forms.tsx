"use client";

import { useActionState, useId, useState } from "react";
import { SlotPicker } from "@/components/hunts/slot-picker";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { SessionFields } from "@/components/panel/session-fields";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { BRACKET_SIZES, sideMulti } from "@/lib/calc/bracket";
import { cn } from "@/lib/cn";
import { formatMulti } from "@/lib/format";
import { BATTLE_STATUSES } from "@/lib/session-status";
import type { Enums } from "@/types/database";
import { addEntry, reviewBattleCall, saveBattle, saveMatch } from "./actions";
import { AmountInput } from "@/components/ui/amount-input";
import { confirmFromText, useConfirmSubmit } from "@/components/ui/confirm-dialog";

const moneyInput = cn(inputClass, "num");

type Battle = {
  id: string;
  title: string;
  casino_id: string | null;
  currency: Enums<"currency_code">;
  status: Enums<"battle_status">;
  size: number;
};

export function BattleForm({ battle, casinos }: { battle?: Battle; casinos: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveBattle, INITIAL_ACTION_STATE);
  const id = useId();
  // live y finished se manejan con "Arrancar" y los resultados.
  const editableStatus = battle && (battle.status === "draft" || battle.status === "open");

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {battle ? <input type="hidden" name="id" value={battle.id} /> : null}
      <SessionFields
        id={id}
        title={battle?.title}
        casinoId={battle?.casino_id}
        currency={battle?.currency}
        casinos={casinos}
        placeholder="Battle de los domingos"
      />
      {!battle || editableStatus ? (
        <Field id={`${id}-size`} label="Arranca en" hint="Define cuántos slots entran al cuadro.">
          <select id={`${id}-size`} name="size" defaultValue={battle?.size ?? 16} className={inputClass}>
            {BRACKET_SIZES.map((b) => (
              <option key={b.size} value={b.size}>
                {b.label} ({b.size} slots)
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {editableStatus ? (
        <Field
          id={`${id}-status`}
          label="Estado"
          hint={BATTLE_STATUSES.find((s) => s.value === battle.status)?.hint}
          className="sm:col-span-2"
        >
          <select id={`${id}-status`} name="status" defaultValue={battle.status} className={inputClass}>
            {BATTLE_STATUSES.filter((s) => s.value === "draft" || s.value === "open").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <SubmitButton>{battle ? "Guardar" : "Crear battle"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function AddEntryForm({ battleId }: { battleId: string }) {
  const [round, setRound] = useState(0);
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await addEntry(prev, data);
    if (result.ok) setRound((r) => r + 1);
    return result;
  }, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
      <input type="hidden" name="battle_id" value={battleId} />
      <Field id={`${id}-slot`} label="Agregar slot" hint="Si no está en el catálogo, se agrega.">
        <SlotPicker key={round} id={`${id}-slot`} required />
      </Field>
      <SubmitButton className="h-10 sm:mt-5">Agregar</SubmitButton>
      <FormMessage state={state} className="sm:col-span-2" />
    </form>
  );
}

/** Aceptar o rechazar el call de un viewer: si se acepta, su slot entra al cuadro. */
export function BattleCallReviewForm({ battleId, callId }: { battleId: string; callId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(reviewBattleCall, INITIAL_ACTION_STATE);
  // Rechazar es definitivo: se confirma. Aceptar va directo.
  const confirmReject = useConfirmSubmit(
    confirmFromText(
      "¿Rechazar el call? El viewer no va a poder pedir otro slot. Usalo, por ejemplo, si el bono no salió.",
    ),
    (b) => b?.getAttribute("value") === "reject",
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2" onSubmit={confirmReject.onSubmit}>
      {confirmReject.dialog}
      <input type="hidden" name="id" value={callId} />
      <input type="hidden" name="battle_id" value={battleId} />
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
        className="h-9 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-live"
      >
        Rechazar
      </button>
      {state.error ? <FormMessage state={{ error: state.error }} className="w-full" /> : null}
    </form>
  );
}

type Side = { name: string; bet: number | null; payout: number | null };

/** Resultado de un cruce: apuesta y pago de cada lado. Gana el de mayor multi. */
export function MatchForm({
  battleId,
  matchId,
  a,
  b,
  locked,
}: {
  battleId: string;
  matchId: string;
  a: Side;
  b: Side;
  locked: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveMatch, INITIAL_ACTION_STATE);
  const [values, setValues] = useState({
    bet_a: a.bet === null ? "" : String(a.bet),
    payout_a: a.payout === null ? "" : String(a.payout),
    bet_b: b.bet === null ? "" : String(b.bet),
    payout_b: b.payout === null ? "" : String(b.payout),
  });
  const id = useId();
  const num = (v: string) => (v === "" ? null : Number(v));

  const side = (key: "a" | "b", info: Side) => {
    const multi = sideMulti(num(values[`bet_${key}`]), num(values[`payout_${key}`]));
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-semibold">{info.name}</span>
        {(["bet", "payout"] as const).map((field) => {
          const name = `${field}_${key}` as const;
          return (
            <span key={name}>
              <label htmlFor={`${id}-${name}`} className="sr-only">
                {field === "bet" ? "Apuesta" : "Pago"} de {info.name}
              </label>
              <AmountInput
                id={`${id}-${name}`}
                name={name}
                placeholder={field === "bet" ? "Apuesta" : "Pago"}
                disabled={locked}
                value={values[name]}
                onValueChange={(raw) => setValues((v) => ({ ...v, [name]: raw }))}
                className={cn(moneyInput, "h-9 w-28")}
              />
            </span>
          );
        })}
        <span className="num w-20 text-right text-sm text-gold">{multi !== null ? formatMulti(multi) : "—"}</span>
      </div>
    );
  };

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={matchId} />
      <input type="hidden" name="battle_id" value={battleId} />
      {side("a", a)}
      {side("b", b)}
      {locked ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton variant="secondary" pendingLabel="…">
            Guardar cruce
          </SubmitButton>
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}
