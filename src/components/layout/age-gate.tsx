"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";

const STORAGE_KEY = "ms-age-confirmed";

function readConfirmed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveConfirmed() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Navegación privada o storage bloqueado: se vuelve a preguntar la próxima vez.
  }
}

export function AgeGate() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!readConfirmed()) dialogRef.current?.showModal();
  }, []);

  const confirm = () => {
    saveConfirmed();
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="age-gate-title"
      aria-describedby="age-gate-desc"
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-line-strong bg-surface p-0 text-text backdrop:bg-bg/90 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
        <ShieldAlert className="size-10 text-gold" aria-hidden />
        <h2 id="age-gate-title" className="font-display text-3xl tracking-wide uppercase">
          {denied ? "Volvé cuando tengas 18" : "¿Sos mayor de 18?"}
        </h2>
        <p id="age-gate-desc" className="text-sm text-muted">
          {denied
            ? "Esta web habla de casino online y es solo para mayores de edad."
            : "Esta web habla de casino online y apuestas. Para entrar tenés que ser mayor de 18 años."}
        </p>
        {denied ? (
          <Link href="/juego-responsable" className={buttonClasses({ variant: "secondary" })} onClick={() => dialogRef.current?.close()}>
            Leer sobre juego responsable
          </Link>
        ) : (
          <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
            <button type="button" autoFocus onClick={confirm} className={buttonClasses({ className: "flex-1" })}>
              Sí, tengo 18 o más
            </button>
            <button
              type="button"
              onClick={() => setDenied(true)}
              className={buttonClasses({ variant: "secondary", className: "flex-1" })}
            >
              No
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
