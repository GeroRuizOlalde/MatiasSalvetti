"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/panel/form";
import { ReplayFields } from "@/components/replays/replay-fields";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { submitReplay } from "./actions";

/** Compartir un replay: link, slot, montos (opcionales) y un comentario corto. */
export function ReplayForm({ providers }: { providers: { name: string; domain: string }[] }) {
  const [round, setRound] = useState(0);
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await submitReplay(prev, data);
    if (result.ok) setRound((r) => r + 1);
    return result;
  }, INITIAL_ACTION_STATE);

  return (
    <div className="space-y-3">
      <ReplayFields
        key={round}
        action={formAction}
        providers={providers}
        submitLabel="Compartir replay"
        pendingLabel="Enviando…"
      />
      <FormMessage state={state} />
    </div>
  );
}
