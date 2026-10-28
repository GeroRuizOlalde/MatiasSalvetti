"use client";

import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "name" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step"
> & {
  name: string;
  /** Controlado: el número "crudo" ("1500.5"). */
  value?: string;
  defaultValue?: number | string | null;
  onValueChange?: (raw: string) => void;
  /** Con centavos (coma decimal). Para puntos y cantidades, false. */
  decimals?: boolean;
  allowNegative?: boolean;
};

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** "1500.5" -> "1.500,5" */
export function formatAmountInput(raw: string) {
  if (!raw) return "";
  const negative = raw.startsWith("-");
  const [int, dec] = raw.replace("-", "").split(".");
  return `${negative ? "-" : ""}${group(int)}${dec !== undefined ? `,${dec}` : ""}`;
}

/** Lo que escribe el usuario ("1.500,5", "1500,") -> número crudo ("1500.5") y cómo mostrarlo. */
export function parseAmountInput(text: string, decimals: boolean, allowNegative: boolean) {
  const negative = allowNegative && text.trim().startsWith("-");
  const comma = decimals ? text.indexOf(",") : -1;
  const intText = comma >= 0 ? text.slice(0, comma) : text;
  let int = intText.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const dec =
    comma >= 0
      ? text
          .slice(comma + 1)
          .replace(/\D/g, "")
          .slice(0, 2)
      : undefined;
  if (dec !== undefined && !int) int = "0";
  if (!int) return { raw: negative ? "-" : "", display: negative ? "-" : "" };
  const sign = negative ? "-" : "";
  return {
    raw: `${sign}${int}${dec !== undefined ? `.${dec}` : ""}`,
    display: `${sign}${group(int)}${dec !== undefined ? `,${dec}` : ""}`,
  };
}

const toRaw = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? "" : String(value);

/**
 * Campo de monto que va poniendo los puntos de miles mientras se escribe (1.000.000,50).
 * Manda al servidor el número limpio en un campo oculto con `name`.
 */
export function AmountInput({
  name,
  value,
  defaultValue,
  onValueChange,
  decimals = true,
  allowNegative = false,
  disabled,
  ...rest
}: Props) {
  const [ownRaw, setOwnRaw] = useState(() => toRaw(defaultValue));
  const raw = value ?? ownRaw;
  const [display, setDisplay] = useState(() => formatAmountInput(raw));
  const [shownRaw, setShownRaw] = useState(raw);
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  // Si el valor cambia desde afuera (otro campo, un reset), se vuelve a formatear.
  if (raw !== shownRaw) {
    setShownRaw(raw);
    setDisplay(formatAmountInput(raw));
  }

  // Deja el cursor después del mismo dígito aunque se hayan agregado o sacado puntos.
  useLayoutEffect(() => {
    const input = ref.current;
    if (caret.current === null || !input || document.activeElement !== input) return;
    let seen = 0;
    let pos = 0;
    while (pos < display.length && seen < caret.current) {
      if (/[\d,-]/.test(display[pos])) seen++;
      pos++;
    }
    input.setSelectionRange(pos, pos);
    caret.current = null;
  }, [display]);

  return (
    <>
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        autoComplete="off"
        disabled={disabled}
        value={display}
        onChange={(e) => {
          let text = e.target.value;
          // El punto del teclado numérico se toma como coma decimal.
          if (decimals && text.endsWith(".") && !display.endsWith(".") && !text.includes(",")) {
            text = `${text.slice(0, -1)},`;
          }
          const before = text.slice(0, e.target.selectionStart ?? text.length);
          caret.current = (before.match(/[\d,-]/g) ?? []).length;
          const next = parseAmountInput(text, decimals, allowNegative);
          setDisplay(next.display);
          setShownRaw(next.raw);
          if (value === undefined) setOwnRaw(next.raw);
          onValueChange?.(next.raw);
        }}
      />
      <input type="hidden" name={name} value={raw === "-" ? "" : raw} disabled={disabled} />
    </>
  );
}
