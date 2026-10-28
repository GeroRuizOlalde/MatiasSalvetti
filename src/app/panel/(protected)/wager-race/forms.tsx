"use client";

import { useActionState, useId } from "react";
import { Field, FormMessage, inputClass, SubmitButton, textareaClass } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import type { Enums } from "@/types/database";
import { importWagers, saveRace, updateEntry, type ImportWagerState } from "./actions";

type Race = {
  id: string;
  title: string;
  casino_id: string;
  currency: Enums<"currency_code">;
  /** Ya en formato datetime-local, hora de Argentina. */
  startsAt: string;
  endsAt: string;
  prizes: number[];
  rules_md: string | null;
  status: Enums<"wager_race_status">;
};

export function RaceForm({ race, casinos }: { race?: Race; casinos: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveRace, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {race ? <input type="hidden" name="id" value={race.id} /> : null}
      <Field id={`${id}-title`} label="Título" className="sm:col-span-2">
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={80}
          defaultValue={race?.title}
          placeholder="Wager Race de noviembre"
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-casino`} label="Casino">
        <select id={`${id}-casino`} name="casino_id" required defaultValue={race?.casino_id} className={inputClass}>
          {casinos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${id}-currency`} label="Moneda">
        <select id={`${id}-currency`} name="currency" defaultValue={race?.currency ?? "USD"} className={inputClass}>
          <option value="USD">USD</option>
          <option value="ARS">ARS</option>
        </select>
      </Field>
      <Field id={`${id}-start`} label="Empieza (hora AR)">
        <input
          id={`${id}-start`}
          name="starts_at"
          type="datetime-local"
          required
          defaultValue={race?.startsAt}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-end`} label="Termina (hora AR)">
        <input
          id={`${id}-end`}
          name="ends_at"
          type="datetime-local"
          required
          defaultValue={race?.endsAt}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-status`} label="Estado" hint="Publicada se ve en la web." className="sm:col-span-2">
        <select id={`${id}-status`} name="status" defaultValue={race?.status ?? "draft"} className={inputClass}>
          <option value="draft">Borrador</option>
          <option value="published">Publicada</option>
        </select>
      </Field>
      <Field id={`${id}-prizes`} label="Premios" hint="Uno por renglón, del 1.º para abajo." className="sm:col-span-2">
        <textarea
          id={`${id}-prizes`}
          name="prizes"
          rows={5}
          defaultValue={race?.prizes.join("\n")}
          placeholder={"500\n250\n100"}
          className={cn(textareaClass, "num")}
        />
      </Field>
      <Field id={`${id}-rules`} label="Reglas (opcional, Markdown)" className="sm:col-span-2">
        <textarea
          id={`${id}-rules`}
          name="rules_md"
          rows={5}
          maxLength={5000}
          defaultValue={race?.rules_md ?? ""}
          className={textareaClass}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <SubmitButton>{race ? "Guardar" : "Crear carrera"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ImportWagersForm({ raceId }: { raceId: string }) {
  const [state, formAction] = useActionState<ImportWagerState, FormData>(importWagers, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="race_id" value={raceId} />
      <p className="text-sm text-muted">
        El reporte del casino en CSV: primera columna el <strong>ID de la cuenta</strong>, segunda el{" "}
        <strong>wager del período</strong> (reemplaza el valor anterior). Solo cuentan las cuentas verificadas de este
        casino.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={id} className="sr-only">
          Archivo CSV de wager
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
          Importar wager
        </SubmitButton>
      </div>
      <FormMessage state={state} />
      {state.unmatched?.length ? (
        <details className="rounded-lg border border-gold/40 bg-gold/5 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-gold">
            {state.unmatched.length} IDs del archivo no tienen una cuenta verificada
          </summary>
          <p className="mt-2 text-xs text-subtle">No están verificados o el ID no coincide. Se muestran hasta 100.</p>
          <p className="num mt-2 text-xs break-all text-muted">{state.unmatched.join(", ")}</p>
        </details>
      ) : null}
    </form>
  );
}

export function EntryForm({ raceId, accountId, wager }: { raceId: string; accountId: string; wager: number }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateEntry, INITIAL_ACTION_STATE);
  const id = useId();
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="race_id" value={raceId} />
      <input type="hidden" name="account_id" value={accountId} />
      <label htmlFor={id} className="sr-only">
        Wager
      </label>
      <input id={id} name="wager" defaultValue={wager} inputMode="decimal" className={cn(inputClass, "num h-9 w-36")} />
      <SubmitButton variant="secondary" pendingLabel="…">
        Guardar
      </SubmitButton>
      {state.error ? <span className="text-xs text-live">{state.error}</span> : null}
    </form>
  );
}
