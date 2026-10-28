"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { Field, FormMessage, inputClass, SubmitButton, textareaClass } from "@/components/panel/form";
import { CopyButton } from "@/components/ui/copy-button";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { regenerateOverlayToken, saveGeneral, saveHomeStats, savePartner, saveSocials } from "./actions";

const SOCIAL_FIELDS = [
  ["twitch", "Twitch"],
  ["kick", "Kick"],
  ["youtube", "YouTube"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["discord", "Discord"],
  ["whatsapp", "WhatsApp"],
] as const;

type Socials = Record<(typeof SOCIAL_FIELDS)[number][0], string>;

export function SocialsForm({ socials, primary }: { socials: Socials; primary: "twitch" | "kick" }) {
  const [state, action] = useActionState<ActionState, FormData>(saveSocials, INITIAL_ACTION_STATE);
  const id = useId();
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {SOCIAL_FIELDS.map(([key, label]) => (
        <Field key={key} id={`${id}-${key}`} label={label}>
          <input
            id={`${id}-${key}`}
            name={key}
            type="url"
            required
            defaultValue={socials[key]}
            className={inputClass}
          />
        </Field>
      ))}
      <Field
        id={`${id}-primary`}
        label="Plataforma principal"
        hint="A dónde lleva el botón cuando el stream está offline."
      >
        <select id={`${id}-primary`} name="primary_platform" defaultValue={primary} className={inputClass}>
          <option value="twitch">Twitch</option>
          <option value="kick">Kick</option>
        </select>
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton>Guardar redes</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function HomeStatsForm({ years, prizes }: { years: number | null; prizes: number | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveHomeStats, INITIAL_ACTION_STATE);
  const id = useId();
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field id={`${id}-years`} label="Años en stream" hint="Vacío = no se muestra.">
        <input
          id={`${id}-years`}
          name="years_streaming"
          inputMode="numeric"
          defaultValue={years ?? ""}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-prizes`} label="Premios del mes (ARS)" hint="Vacío = no se muestra.">
        <input
          id={`${id}-prizes`}
          name="monthly_prizes"
          inputMode="decimal"
          defaultValue={prizes ?? ""}
          className={inputClass}
        />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton>Guardar stats</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function GeneralForm({ helpline, minAgeDays }: { helpline: string; minAgeDays: number }) {
  const [state, action] = useActionState<ActionState, FormData>(saveGeneral, INITIAL_ACTION_STATE);
  const id = useId();
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field
        id={`${id}-help`}
        label="Línea de ayuda (juego responsable)"
        hint="Se muestra en el footer y en /juego-responsable."
      >
        <input
          id={`${id}-help`}
          name="helpline"
          required
          maxLength={200}
          defaultValue={helpline}
          className={inputClass}
        />
      </Field>
      <Field
        id={`${id}-age`}
        label="Antigüedad mínima de la cuenta de Twitch (días)"
        hint="0 = sin mínimo. Filtra multicuentas recién creadas."
      >
        <input
          id={`${id}-age`}
          name="min_age_days"
          type="number"
          min={0}
          max={3650}
          defaultValue={minAgeDays}
          className={inputClass}
        />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton>Guardar</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function OverlayTokenForm({ token }: { token: string | null }) {
  const [state, action] = useActionState<ActionState>(regenerateOverlayToken, INITIAL_ACTION_STATE);
  const [visible, setVisible] = useState(false);
  return (
    <form action={action} className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-3">
        <code className="num flex-1 truncate text-sm">{token ? (visible ? token : "•".repeat(24)) : "Sin token"}</code>
        {token ? (
          <>
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Ocultar token" : "Mostrar token"}
              className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-text"
            >
              {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
            <CopyButton value={token} label="Copiar token" />
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton variant="secondary" pendingLabel="Generando…">
          Regenerar token
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

type Partner = { casino_slug: string; description: string; perks: { label: string; value: string }[] };

export function PartnerForm({ partner, casinos }: { partner: Partner; casinos: { slug: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(savePartner, INITIAL_ACTION_STATE);
  const id = useId();
  const rows = Array.from({ length: 4 }, (_, i) => partner.perks[i] ?? { label: "", value: "" });
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field id={`${id}-casino`} label="Casino partner" hint="El link y el código salen de Catálogo → Casinos.">
        <select id={`${id}-casino`} name="casino_slug" defaultValue={partner.casino_slug} className={inputClass}>
          {casinos.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${id}-desc`} label="Texto" className="sm:col-span-2">
        <textarea
          id={`${id}-desc`}
          name="description"
          rows={3}
          maxLength={400}
          required
          defaultValue={partner.description}
          className={textareaClass}
        />
      </Field>
      <fieldset className="space-y-2 sm:col-span-2">
        <legend className="mb-1 text-xs font-semibold text-subtle">Beneficios (vacío = no se muestra)</legend>
        {rows.map((perk, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr] gap-2">
            <label htmlFor={`${id}-pl-${i}`} className="sr-only">
              Beneficio {i + 1}
            </label>
            <input
              id={`${id}-pl-${i}`}
              name={`perk_label_${i}`}
              maxLength={60}
              defaultValue={perk.label}
              placeholder="Bono de bienvenida"
              className={inputClass}
            />
            <label htmlFor={`${id}-pv-${i}`} className="sr-only">
              Valor del beneficio {i + 1}
            </label>
            <input
              id={`${id}-pv-${i}`}
              name={`perk_value_${i}`}
              maxLength={30}
              defaultValue={perk.value}
              placeholder="100%"
              className={inputClass}
            />
          </div>
        ))}
      </fieldset>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton>Guardar partner</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
