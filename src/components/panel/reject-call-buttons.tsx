import type { CallRejectReason } from "@/lib/call-reject";

const OPTIONS: { value: CallRejectReason; label: string; title: string }[] = [
  {
    value: "not_triggered",
    label: "No salió",
    title: "El bono no salió. El viewer no puede pedir otro.",
  },
  {
    value: "already_called",
    label: "Ya calleada",
    title: "Ya la pidió otro viewer. Puede pedir otra.",
  },
  {
    value: "unavailable",
    label: "No disponible",
    title: "No está disponible en el casino. Puede pedir otra.",
  },
];

/** Los motivos para rechazar un call: van en el mismo form, como `decision`. */
export function RejectCallButtons() {
  return (
    <div
      role="group"
      aria-label="Rechazar el call"
      className="flex flex-wrap items-center gap-1"
    >
      <span className="text-xs text-subtle">Rechazar:</span>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="submit"
          name="decision"
          value={option.value}
          formNoValidate
          title={option.title}
          className="h-9 rounded-lg px-2.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-live"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Solo «no salió» es definitivo: ese se confirma. */
export const isFinalReject = (button: HTMLElement | null) =>
  button?.getAttribute("value") === "not_triggered";

export const FINAL_REJECT_TEXT =
  "¿El bono no salió? El viewer no va a poder pedir otro slot. Si la máquina ya estaba pedida o no está disponible, usá esas opciones: así puede pedir otra.";
