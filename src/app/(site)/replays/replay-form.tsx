"use client";

import { useActionState, useId, useState } from "react";
import { SlotPicker } from "@/components/hunts/slot-picker";
import { Field, FormMessage, inputClass, SubmitButton, textareaClass } from "@/components/panel/form";
import { AmountInput } from "@/components/ui/amount-input";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { matchProvider, replayHost } from "@/lib/replay-providers";
import { submitReplay } from "./actions";

/** Compartir un replay: link, slot, multi (opcional) y un comentario corto. */
export function ReplayForm({ providers }: { providers: { name: string; domain: string }[] }) {
  const [round, setRound] = useState(0);
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await submitReplay(prev, data);
    if (result.ok) setRound((r) => r + 1);
    return result;
  }, INITIAL_ACTION_STATE);

  return (
    <div className="space-y-3">
      <Fields key={round} action={formAction} providers={providers} />
      <FormMessage state={state} />
    </div>
  );
}

function Fields({
  action,
  providers,
}: {
  action: (data: FormData) => void;
  providers: { name: string; domain: string }[];
}) {
  const id = useId();
  const [url, setUrl] = useState("");
  const host = replayHost(url.trim());
  const provider = host ? matchProvider(host, providers) : null;

  return (
    <form action={action} className="grid gap-3">
      <Field
        id={`${id}-url`}
        label="Link del replay"
        hint={
          host
            ? provider
              ? `Replay de ${provider.name}.`
              : "No conocemos este proveedor: el panel lo va a revisar."
            : "Copiá el link para compartir el replay desde el juego."
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
        <SlotPicker id={`${id}-slot`} required />
      </Field>
      <Field id={`${id}-multi`} label="Multi (opcional)">
        <AmountInput id={`${id}-multi`} name="multi" placeholder="Ej.: 1.250" className={inputClass} />
      </Field>
      <Field id={`${id}-note`} label="Comentario (opcional)">
        <textarea
          id={`${id}-note`}
          name="note"
          maxLength={200}
          rows={2}
          placeholder="Ej.: Entró con 3 scatters y pagó todo en el último giro."
          className={textareaClass}
        />
      </Field>
      <div>
        <SubmitButton pendingLabel="Enviando…">Compartir replay</SubmitButton>
      </div>
    </form>
  );
}
