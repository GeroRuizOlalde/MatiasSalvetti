import type { Enums } from "@/types/database";

export const TIME_ZONE = "America/Argentina/Buenos_Aires";
export const LOCALE = "es-AR";

const NBSP = " ";

const CURRENCY_PREFIX: Record<Enums<"currency_code">, string> = {
  ARS: "$",
  USD: "US$",
};

export function currencyPrefix(currency: Enums<"currency_code">) {
  return CURRENCY_PREFIX[currency];
}

function number(value: number, fractionDigits: number) {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: "always",
  }).format(value);
}

/** `$ 1.000.000` · `$ 150,50` · `US$ 20`. Decimales solo si el monto los tiene. */
export function formatMoney(amount: number, currency: Enums<"currency_code"> = "ARS") {
  const rounded = Math.round(amount * 100) / 100;
  const digits = Number.isInteger(rounded) ? 0 : 2;
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${CURRENCY_PREFIX[currency]}${NBSP}${number(Math.abs(rounded), digits)}`;
}

/** `100,00x` */
export function formatMulti(multi: number) {
  return `${number(multi, 2)}x`;
}

export function formatInteger(value: number) {
  return number(value, 0);
}

/** Fecha y hora en horario de Buenos Aires, ej. `lun 27/10 · 21:30`. */
export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, weekday: "short" }).format(d).replace(".", "");
  const dm = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" }).format(d);
  const hm = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return `${day} ${dm} · ${hm}`;
}

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** `1239•••623`. IDs cortos muestran menos dígitos para no revelarlos casi enteros. */
export function maskAccountId(id: string) {
  const clean = id.trim();
  if (clean.length <= 4) return "•••";
  const visible = clean.length >= 10 ? [4, 3] : [2, 2];
  return `${clean.slice(0, visible[0])}•••${clean.slice(-visible[1])}`;
}

/** ISO → valor para <input type="datetime-local"> en hora de Buenos Aires (`2026-11-01T21:30`). */
export function toArgentinaInput(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** ¿La fecha ya pasó? (para páginas dinámicas; en las cacheadas, calcularlo dentro del caché). */
export function isPast(date: Date | string) {
  return new Date(date).getTime() <= Date.now();
}
