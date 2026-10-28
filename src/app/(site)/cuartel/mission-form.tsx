"use client";

import { ExternalLink } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import type { Enums } from "@/types/database";
import { claimMission } from "./actions";

export function MissionForm({
  missionId,
  type,
  url,
}: {
  missionId: string;
  type: Enums<"mission_type">;
  url: string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(claimMission, INITIAL_ACTION_STATE);
  // Las de link se reclaman después de abrirlo.
  const [visited, setVisited] = useState(type !== "link");
  const id = useId();

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="mission_id" value={missionId} />
      <div className="flex flex-wrap items-center gap-2">
        {type === "code" ? (
          <>
            <label htmlFor={id} className="sr-only">
              Palabra secreta
            </label>
            <input
              id={id}
              name="code"
              required
              maxLength={40}
              autoComplete="off"
              placeholder="Palabra del stream"
              className={cn(inputClass, "h-9 w-48")}
            />
          </>
        ) : null}
        {type === "link" && url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setVisited(true)}
            className="flex h-9 items-center gap-1 rounded-lg border border-line-strong px-3 text-sm font-semibold hover:border-accent-text"
          >
            Abrir <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
        {visited ? <SubmitButton pendingLabel="…">Reclamar</SubmitButton> : null}
      </div>
      <FormMessage state={state} />
    </form>
  );
}
