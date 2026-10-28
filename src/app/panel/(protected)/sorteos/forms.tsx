"use client";

import { useActionState, useId, useState } from "react";
import { Field, FormMessage, inputClass, SubmitButton, textareaClass } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import type { Enums } from "@/types/database";
import { saveGiveaway, setWinnerStatus } from "./actions";

const numInput = cn(inputClass, "num");

type Giveaway = {
  id: string;
  title: string;
  prize: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  status: Enums<"giveaway_status">;
  entry_mode: Enums<"giveaway_entry_mode">;
  max_tickets_per_user: number;
  winners_count: number;
  min_level: number;
  casino_id: string | null;
  image_path: string | null;
};

export function GiveawayForm({ giveaway, casinos }: { giveaway?: Giveaway; casinos: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveGiveaway, INITIAL_ACTION_STATE);
  const [mode, setMode] = useState<Enums<"giveaway_entry_mode">>(giveaway?.entry_mode ?? "free");
  const id = useId();

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {giveaway ? <input type="hidden" name="id" value={giveaway.id} /> : null}
      <Field id={`${id}-title`} label="Título" className="sm:col-span-2">
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={80}
          defaultValue={giveaway?.title}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-prize`} label="Premio" className="sm:col-span-2">
        <input
          id={`${id}-prize`}
          name="prize"
          required
          maxLength={120}
          defaultValue={giveaway?.prize}
          placeholder="US$ 50 en saldo"
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-desc`} label="Descripción y condiciones (opcional)" className="sm:col-span-2 lg:col-span-4">
        <textarea
          id={`${id}-desc`}
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={giveaway?.description ?? ""}
          className={textareaClass}
        />
      </Field>
      <Field id={`${id}-start`} label="Abre (hora AR)">
        <input
          id={`${id}-start`}
          name="starts_at"
          type="datetime-local"
          required
          defaultValue={giveaway?.startsAt}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-end`} label="Cierra (hora AR)">
        <input
          id={`${id}-end`}
          name="ends_at"
          type="datetime-local"
          required
          defaultValue={giveaway?.endsAt}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-status`} label="Estado" hint="Publicado se ve en la web.">
        <select id={`${id}-status`} name="status" defaultValue={giveaway?.status ?? "draft"} className={inputClass}>
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
        </select>
      </Field>
      <Field id={`${id}-winners`} label="Ganadores">
        <input
          id={`${id}-winners`}
          name="winners_count"
          type="number"
          min={1}
          max={100}
          required
          defaultValue={giveaway?.winners_count ?? 1}
          className={numInput}
        />
      </Field>
      <Field id={`${id}-mode`} label="Cómo se participa">
        <select
          id={`${id}-mode`}
          name="entry_mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as Enums<"giveaway_entry_mode">)}
          className={inputClass}
        >
          <option value="free">Gratis (una chance por persona)</option>
          <option value="tickets">Con tickets (cada ticket, una chance)</option>
        </select>
      </Field>
      {mode === "tickets" ? (
        <Field id={`${id}-max`} label="Máximo de tickets por persona">
          <input
            id={`${id}-max`}
            name="max_tickets_per_user"
            type="number"
            min={1}
            max={1000}
            required
            defaultValue={giveaway?.max_tickets_per_user ?? 10}
            className={numInput}
          />
        </Field>
      ) : (
        <input type="hidden" name="max_tickets_per_user" value="1" />
      )}
      <Field id={`${id}-level`} label="Nivel mínimo">
        <input
          id={`${id}-level`}
          name="min_level"
          type="number"
          min={1}
          required
          defaultValue={giveaway?.min_level ?? 1}
          className={numInput}
        />
      </Field>
      <Field id={`${id}-casino`} label="Exigir cuenta verificada en">
        <select id={`${id}-casino`} name="casino_id" defaultValue={giveaway?.casino_id ?? ""} className={inputClass}>
          <option value="">No exigir</option>
          {casinos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${id}-image`} label="Imagen (opcional)" className="sm:col-span-2">
        <input
          id={`${id}-image`}
          name="image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-text"
        />
      </Field>
      {giveaway?.image_path ? (
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-muted">
          <input type="checkbox" name="remove_image" className="size-4 accent-accent" />
          Quitar imagen
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <SubmitButton>{giveaway ? "Guardar" : "Crear sorteo"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

const STATUS_LABEL = {
  pending: "Sin contactar",
  contacted: "Contactado",
  delivered: "Entregado",
  void: "Anulado",
} as const;

export function WinnerStatusForm({
  giveawayId,
  userId,
  status,
}: {
  giveawayId: string;
  userId: string;
  status: Enums<"winner_status">;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(setWinnerStatus, INITIAL_ACTION_STATE);
  const id = useId();
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="giveaway_id" value={giveawayId} />
      <input type="hidden" name="user_id" value={userId} />
      <label htmlFor={id} className="sr-only">
        Estado del ganador
      </label>
      <select id={id} name="status" defaultValue={status} className={cn(inputClass, "h-9 w-40")}>
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <SubmitButton variant="secondary" pendingLabel="…">
        Guardar
      </SubmitButton>
      {state.error ? <span className="text-xs text-live">{state.error}</span> : null}
      {state.ok ? <span className="text-xs text-accent-text">{state.ok}</span> : null}
    </form>
  );
}
