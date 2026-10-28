"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Sin permiso de portapapeles: el código igual queda visible para copiarlo a mano.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copiado" : label}
      className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-text"
    >
      {copied ? <Check className="size-4 text-accent-text" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span aria-live="polite" className="sr-only">
        {copied ? "Código copiado" : ""}
      </span>
    </button>
  );
}
