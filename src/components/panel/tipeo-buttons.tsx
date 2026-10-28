"use client";

import { useActionState } from "react";
import { decideTipeo } from "@/app/panel/(protected)/hunts/actions";
import { FormMessage } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";

/**
 * «Dar tipeo» / «Descartar» para una recomendación, o «Quitar» para uno ya dado.
 * `kind` dice si es un bono de hunt o una compra de Bonus Buys.
 */
export function TipeoButtons({ kind, id, given }: { kind: "bonus" | "buy"; id: string; given?: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(decideTipeo, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      {given ? null : (
        <button
          type="submit"
          name="give"
          value="1"
          disabled={pending}
          className="h-9 rounded-lg bg-gold px-3 text-sm font-semibold text-bg hover:brightness-110 disabled:opacity-60"
        >
          Dar tipeo
        </button>
      )}
      <button
        type="submit"
        name="give"
        value="0"
        disabled={pending}
        className="h-9 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-live disabled:opacity-60"
      >
        {given ? "Quitar" : "Descartar"}
      </button>
      {state.error ? <FormMessage state={{ error: state.error }} className="w-full" /> : null}
    </form>
  );
}
