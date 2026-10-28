"use client";

import { Field, inputClass } from "./form";

/** Título, casino y moneda: lo que comparten las sesiones de Buys y las Battles. */
export function SessionFields({
  id,
  title,
  casinoId,
  currency,
  casinos,
  placeholder,
}: {
  id: string;
  title?: string;
  casinoId?: string | null;
  currency?: "ARS" | "USD";
  casinos: { id: string; name: string }[];
  placeholder: string;
}) {
  return (
    <>
      <Field id={`${id}-title`} label="Título" className="sm:col-span-2">
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={80}
          defaultValue={title}
          placeholder={placeholder}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-casino`} label="Casino">
        <select id={`${id}-casino`} name="casino_id" defaultValue={casinoId ?? ""} className={inputClass}>
          <option value="">Sin casino</option>
          {casinos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${id}-currency`} label="Moneda">
        <select id={`${id}-currency`} name="currency" defaultValue={currency ?? "ARS"} className={inputClass}>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </Field>
    </>
  );
}
