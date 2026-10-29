"use client";

import { ExternalLink, Play, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";

type Props = {
  url: string;
  title: string;
  /** El proveedor deja mostrar el replay dentro de otra web. */
  embeddable: boolean;
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "ghost";
};

/**
 * Botón «Ver replay». Si el proveedor se deja embeber, abre el replay en un
 * reproductor dentro de la página; si no, en otra pestaña.
 */
export function ReplayViewer({
  url,
  title,
  embeddable,
  label = "Ver replay",
  size = "sm",
  variant = "primary",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!embeddable) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant, size })}>
        <ExternalLink className="size-4" aria-hidden /> {label}
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClasses({ variant, size })}>
        <Play className="size-4" aria-hidden /> {label}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        className="m-auto w-[min(72rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-text shadow-2xl shadow-black/60 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <h2 id={titleId} className="min-w-0 flex-1 truncate font-semibold">
            {title}
          </h2>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            <ExternalLink className="size-4" aria-hidden />
            <span className="hidden sm:inline">Abrir en otra pestaña</span>
          </a>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="rounded-md p-2 text-subtle hover:bg-surface-2 hover:text-text"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {/* Se monta solo abierto: el juego del proveedor no carga hasta que se pide. */}
        {open ? (
          <iframe
            src={url}
            title={title}
            allow="autoplay; fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups"
            className="aspect-video max-h-[80vh] w-full bg-black"
          />
        ) : null}
      </dialog>
    </>
  );
}
