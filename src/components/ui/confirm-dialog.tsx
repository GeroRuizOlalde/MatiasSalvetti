"use client";

import { AlertTriangle, HelpCircle } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type ConfirmOptions = {
  /** Texto de la pregunta. Si empieza con "¿…?", eso va de título y el resto de detalle. */
  text: string;
  confirmLabel?: string;
  /** Acciones que borran algo: botón rojo. */
  danger?: boolean;
};

/** "¿Borrar …?" -> { confirmLabel: "Borrar", danger: true }. Sirve para no repetirlo en cada botón. */
export function confirmFromText(text: string): ConfirmOptions {
  const verb = text.match(/^¿\s*([a-záéíóúñü]+)/i)?.[1] ?? "";
  const label = verb ? verb[0].toUpperCase() + verb.slice(1).toLowerCase() : "Confirmar";
  return { text, confirmLabel: label, danger: /^(borrar|quitar|eliminar|rechazar|cancelar)$/i.test(verb) };
}

/** "¿Borrar el hunt? No se puede deshacer." -> título y detalle. */
export function splitConfirmText(text: string) {
  const match = text.match(/^(¿[^?]+\?)\s*([\s\S]*)$/);
  return match ? { title: match[1], detail: match[2] || null } : { title: text, detail: null };
}

/**
 * Confirmación con el diseño de la web, en lugar del `confirm()` del navegador.
 * Devuelve un `onSubmit` para el <form> y el diálogo a renderizar: el envío se frena,
 * se pregunta, y si se acepta el form se vuelve a mandar con el mismo botón.
 */
export function useConfirmSubmit(
  options: ConfirmOptions | null,
  /** Si está, solo se pregunta cuando el botón que envía lo cumple (ej. solo «Rechazar»). */
  when?: (submitter: HTMLElement | null) => boolean,
) {
  const [open, setOpen] = useState(false);
  const pending = useRef<{ form: HTMLFormElement; submitter: HTMLElement | null } | null>(null);
  const approved = useRef(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    if (!options || approved.current || (when && !when(submitter))) {
      approved.current = false;
      return;
    }
    e.preventDefault();
    pending.current = { form: e.currentTarget, submitter };
    setOpen(true);
  };

  const accept = () => {
    setOpen(false);
    const target = pending.current;
    if (!target) return;
    approved.current = true;
    target.form.requestSubmit(target.submitter instanceof HTMLButtonElement ? target.submitter : undefined);
  };

  const dialog = options ? (
    <ConfirmDialog open={open} options={options} onCancel={() => setOpen(false)} onConfirm={accept} />
  ) : null;

  return { onSubmit, dialog };
}

function ConfirmDialog({
  open,
  options,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  options: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const detailId = useId();
  const { title, detail } = splitConfirmText(options.text);
  const Icon = options.danger ? AlertTriangle : HelpCircle;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={detail ? detailId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      // Tocar afuera de la tarjeta cierra.
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-text shadow-2xl shadow-black/60 backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-rise"
    >
      <div className="flex gap-4 p-6">
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            options.danger ? "bg-live/15 text-live" : "bg-accent/15 text-accent-light",
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="font-semibold">
            {title}
          </h2>
          {detail ? (
            <p id={detailId} className="mt-1 text-sm text-muted">
              {detail}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
        <button type="button" onClick={onCancel} className={buttonClasses({ variant: "ghost", size: "sm" })}>
          Cancelar
        </button>
        <button
          type="button"
          autoFocus
          onClick={onConfirm}
          className={buttonClasses({ variant: options.danger ? "live" : "primary", size: "sm" })}
        >
          {options.confirmLabel ?? "Confirmar"}
        </button>
      </div>
    </dialog>
  );
}
