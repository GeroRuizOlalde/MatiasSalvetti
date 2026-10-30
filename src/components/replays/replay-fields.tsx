"use client";

import { useId, useState } from "react";
import { SlotPicker } from "@/components/hunts/slot-picker";
import { Field, inputClass, SubmitButton, textareaClass } from "@/components/panel/form";
import { AmountInput } from "@/components/ui/amount-input";
import { formatMulti } from "@/lib/format";
import { matchProvider, replayHost } from "@/lib/replay-providers";
import type { Enums } from "@/types/database";

/** Lo que se carga de un replay (para editar uno que ya existe). */
export type ReplayDraft = {
  id: string;
  url: string;
  slot_id: string | null;
  slot_name: string;
  note: string | null;
  currency: Enums<"currency_code">;
  bet: number | null;
  bonus_cost: number | null;
  payout: number | null;
  multi: number | null;
};

/** Campos del replay: link, slot, montos y comentario. Los usan «Compartir» y «Editar». */
export function ReplayFields({
  action,
  providers,
  initial,
  submitLabel,
  pendingLabel = "Guardando…",
  hint,
}: {
  action: (data: FormData) => void;
  providers: { name: string; domain: string }[];
  initial?: ReplayDraft;
  submitLabel: string;
  pendingLabel?: string;
  /** Aviso debajo del link (ej.: que cambiarlo lo manda a revisión). */
  hint?: string;
}) {
  const id = useId();
  const [url, setUrl] = useState(initial?.url ?? "");
  const [bet, setBet] = useState(initial?.bet != null ? String(initial.bet) : "");
  const [payout, setPayout] = useState(initial?.payout != null ? String(initial.payout) : "");
  // Con apuesta y pago el multi sale solo; si no, se escribe a mano.
  const autoMulti = Number(bet) > 0 && payout !== "" ? Number(payout) / Number(bet) : null;
  const host = replayHost(url.trim());
  const provider = host ? matchProvider(host, providers) : null;

  return (
    <form action={action} className="grid gap-3">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Field
        id={`${id}-url`}
        label="Link del replay"
        hint={
          hint ??
          (host
            ? provider
              ? `Replay de ${provider.name}.`
              : "No conocemos este proveedor: el panel lo va a revisar."
            : "Copiá el link para compartir el replay desde el juego.")
        }
      >
        <input
          id={`${id}-url`}
          name="url"
          type="url"
          required
          maxLength={500}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-slot`} label="Slot">
        <SlotPicker
          id={`${id}-slot`}
          required
          defaultValue={initial ? { id: initial.slot_id, name: initial.slot_name } : undefined}
        />
      </Field>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Field id={`${id}-currency`} label="Moneda">
          <select
            id={`${id}-currency`}
            name="currency"
            defaultValue={initial?.currency ?? "ARS"}
            className={inputClass}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </Field>
        <Field id={`${id}-bet`} label="Apuesta">
          <AmountInput
            id={`${id}-bet`}
            name="bet"
            defaultValue={initial?.bet}
            onValueChange={setBet}
            placeholder="Ej.: 200"
            className={inputClass}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field id={`${id}-bonus`} label="Valor del bono">
          <AmountInput
            id={`${id}-bonus`}
            name="bonus_cost"
            defaultValue={initial?.bonus_cost}
            placeholder="Si lo compraste"
            className={inputClass}
          />
        </Field>
        <Field id={`${id}-payout`} label="Pagó">
          <AmountInput
            id={`${id}-payout`}
            name="payout"
            defaultValue={initial?.payout}
            onValueChange={setPayout}
            placeholder="Ej.: 50.000"
            className={inputClass}
          />
        </Field>
      </div>
      {autoMulti !== null ? (
        <p className="text-sm text-muted">
          Multi: <span className="num font-bold text-gold">{formatMulti(autoMulti)}</span>
          <span className="text-xs text-subtle"> (pago ÷ apuesta)</span>
        </p>
      ) : (
        <Field
          id={`${id}-multi`}
          label="Multi (x)"
          hint="Si no sabés la apuesta o el pago, poné directo cuántas x pagó."
        >
          <AmountInput
            id={`${id}-multi`}
            name="multi"
            defaultValue={initial?.multi}
            placeholder="Ej.: 2.500"
            className={inputClass}
          />
        </Field>
      )}
      <Field id={`${id}-note`} label="Comentario (opcional)">
        <textarea
          id={`${id}-note`}
          name="note"
          maxLength={200}
          rows={2}
          defaultValue={initial?.note ?? ""}
          placeholder="Ej.: Entró con 3 scatters y pagó todo en el último giro."
          className={textareaClass}
        />
      </Field>
      <div>
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
