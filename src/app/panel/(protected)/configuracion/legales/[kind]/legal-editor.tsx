"use client";

import { useActionState, useId } from "react";
import { Field, FormMessage, inputClass, SubmitButton, textareaClass } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { publishLegalDocument } from "../../actions";

export function LegalEditor({
  kind,
  title,
  content,
  nextVersion,
}: {
  kind: string;
  title: string;
  content: string;
  nextVersion: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(publishLegalDocument, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <Field id={`${id}-title`} label="Título">
        <input id={`${id}-title`} name="title" required maxLength={120} defaultValue={title} className={inputClass} />
      </Field>
      <Field
        id={`${id}-content`}
        label="Contenido (Markdown)"
        hint="## Título de sección · **negrita** · - ítem de lista · > aviso destacado. En juego responsable, {{helpline}} se reemplaza por la línea de ayuda."
      >
        <textarea
          id={`${id}-content`}
          name="content_md"
          required
          rows={24}
          defaultValue={content}
          className={`${textareaClass} num leading-relaxed`}
        />
      </Field>
      {kind === "terms" ? (
        <p className="rounded-lg border border-gold/40 bg-gold/5 px-4 py-3 text-sm">
          Al publicar una versión nueva de las bases, todos los usuarios tienen que volver a aceptarlas antes de
          participar.
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Publicando…">Publicar versión {nextVersion}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
