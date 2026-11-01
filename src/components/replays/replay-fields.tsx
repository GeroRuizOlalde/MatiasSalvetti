"use client";

import { useI18n } from "@/i18n/client";
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
  pendingLabel,
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
  const { t } = useI18n();
  const f = t.replays.fields;
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
        label={f.link}
        hint={hint ?? (host ? (provider ? f.from(provider.name) : f.unknown) : f.linkHint)}
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
      <Field id={`${id}-slot`} label={f.slot}>
        <SlotPicker
          id={`${id}-slot`}
          required
          defaultValue={initial ? { id: initial.slot_id, name: initial.slot_name } : undefined}
        />
      </Field>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Field id={`${id}-currency`} label={f.currency}>
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
        <Field id={`${id}-bet`} label={f.bet}>
          <AmountInput
            id={`${id}-bet`}
            name="bet"
            defaultValue={initial?.bet}
            onValueChange={setBet}
            placeholder={f.betPlaceholder}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field id={`${id}-bonus`} label={f.bonus}>
          <AmountInput
            id={`${id}-bonus`}
            name="bonus_cost"
            defaultValue={initial?.bonus_cost}
            placeholder={f.bonusPlaceholder}
            className={inputClass}
          />
        </Field>
        <Field id={`${id}-payout`} label={f.payout}>
          <AmountInput
            id={`${id}-payout`}
            name="payout"
            defaultValue={initial?.payout}
            onValueChange={setPayout}
            placeholder={f.payoutPlaceholder}
            className={inputClass}
          />
        </Field>
      </div>
      {autoMulti !== null ? (
        <p className="text-sm text-muted">
          {f.multi}: <span className="num font-bold text-gold">{formatMulti(autoMulti)}</span>
          <span className="text-xs text-subtle"> {f.multiFormula}</span>
        </p>
      ) : (
        <Field id={`${id}-multi`} label={f.multiManual} hint={f.multiHint}>
          <AmountInput
            id={`${id}-multi`}
            name="multi"
            defaultValue={initial?.multi}
            placeholder={f.multiPlaceholder}
            className={inputClass}
          />
        </Field>
      )}
      <Field id={`${id}-note`} label={f.note}>
        <textarea
          id={`${id}-note`}
          name="note"
          maxLength={200}
          rows={2}
          defaultValue={initial?.note ?? ""}
          placeholder={f.notePlaceholder}
          className={textareaClass}
        />
      </Field>
      <div>
        <SubmitButton pendingLabel={pendingLabel ?? t.common.saving}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
