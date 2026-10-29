"use client";

import { useActionState, useId } from "react";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import type { Tables } from "@/types/database";
import { saveCasino } from "../actions";

type Casino = Pick<
  Tables<"casinos">,
  "id" | "name" | "slug" | "referral_url" | "code" | "sort_order" | "is_active" | "logo_path"
>;

export function CasinoForm({ casino }: { casino?: Casino }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveCasino, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {casino ? <input type="hidden" name="id" value={casino.id} /> : null}
      <Field id={`${id}-name`} label="Nombre">
        <input id={`${id}-name`} name="name" required maxLength={60} defaultValue={casino?.name} className={inputClass} />
      </Field>
      <Field id={`${id}-slug`} label="Identificador" hint="minúsculas y guiones, ej. 1xslots">
        <input
          id={`${id}-slug`}
          name="slug"
          required
          pattern="[a-z0-9\-]+"
          defaultValue={casino?.slug}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-code`} label="Código">
        <input id={`${id}-code`} name="code" maxLength={40} defaultValue={casino?.code ?? ""} className={inputClass} />
      </Field>
      <Field id={`${id}-order`} label="Orden">
        <input
          id={`${id}-order`}
          name="sort_order"
          type="number"
          min={0}
          max={999}
          defaultValue={casino?.sort_order ?? 0}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-url`} label="Link de referido" className="sm:col-span-2 lg:col-span-3">
        <input
          id={`${id}-url`}
          name="referral_url"
          type="url"
          required
          placeholder="https://"
          defaultValue={casino?.referral_url}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-logo`} label="Logo (PNG, JPG, WebP o SVG)">
        <input
          id={`${id}-logo`}
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-text"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="is_active" defaultChecked={casino?.is_active ?? true} className="size-4 accent-accent" />
          Activo (se muestra en la web)
        </label>
        {casino?.logo_path ? (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="remove_logo" className="size-4 accent-accent" />
            Quitar logo
          </label>
        ) : null}
        <SubmitButton className="ml-auto">{casino ? "Guardar" : "Crear casino"}</SubmitButton>
      </div>
      <FormMessage state={state} className="sm:col-span-2 lg:col-span-4" />
    </form>
  );
}
