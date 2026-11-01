"use client";

import { useActionState, useId } from "react";
import { buttonClasses } from "@/components/ui/button";
import { updateStreamStatus, type StreamStatusState } from "./actions";

type Props = { live: boolean; platform: "twitch" | "kick" };

const inputClass = "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-text";

export function StreamStatusForm({ live, platform }: Props) {
  const [state, formAction, pending] = useActionState<StreamStatusState, FormData>(updateStreamStatus, {});
  const ids = { live: useId(), platform: useId() };

  return (
    <form action={formAction} className="space-y-4">
      <label htmlFor={ids.live} className="flex items-center gap-3">
        <input id={ids.live} type="checkbox" name="live" defaultChecked={live} className="size-5 accent-live" />
        <span className="text-sm font-semibold">Forzar &quot;En vivo&quot;</span>
      </label>

      <div className="max-w-xs">
        <div>
          <label htmlFor={ids.platform} className="mb-1 block text-xs text-subtle">
            Plataforma
          </label>
          <select id={ids.platform} name="platform" defaultValue={platform} className={inputClass}>
            <option value="twitch">Twitch</option>
            <option value="kick">Kick</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClasses({ size: "sm" })}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <p aria-live="polite" className="text-sm">
          {state.error ? <span className="text-live">{state.error}</span> : null}
          {state.ok ? <span className="text-accent-text">Guardado.</span> : null}
        </p>
      </div>
    </form>
  );
}
