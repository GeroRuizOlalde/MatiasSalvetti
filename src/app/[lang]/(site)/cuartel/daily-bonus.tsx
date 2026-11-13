"use client";

import { Flame } from "lucide-react";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/panel/form";
import { useI18n } from "@/i18n/client";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { formatInteger } from "@/lib/format";
import { claimDailyBonus } from "./actions";

type Props = {
  /** Racha vigente (0 si se cortó o nunca reclamó). */
  streak: number;
  claimedToday: boolean;
  /** Lo que paga el próximo reclamo. */
  nextPoints: number;
  /** No puede reclamar: falta aceptar las bases o está fuera del sistema de puntos. */
  disabled: boolean;
  pointsBlocked: boolean;
};

/** Bonus diario con racha: se reclama una vez por día. */
export function DailyBonus({ streak, claimedToday, nextPoints, disabled, pointsBlocked }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(claimDailyBonus, INITIAL_ACTION_STATE);
  const { t } = useI18n();
  const d = t.hq.daily;

  return (
    <section
      aria-labelledby="daily-title"
      className="flex flex-wrap items-center gap-4 rounded-2xl border border-gold/40 bg-gold/5 p-5"
    >
      <Flame className="size-9 shrink-0 text-gold" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 id="daily-title" className="font-display text-2xl leading-none tracking-wide uppercase">
          {d.title}
        </h2>
        {pointsBlocked ? null : (
          <p className="mt-1 text-sm font-semibold text-gold">{streak > 0 ? d.streak(streak) : d.noStreak}</p>
        )}
        <p className="text-sm text-muted">
          {pointsBlocked
            ? d.blocked
            : claimedToday
              ? d.tomorrow(formatInteger(nextPoints))
              : d.today(formatInteger(nextPoints))}
        </p>
      </div>
      {claimedToday || disabled ? null : (
        <form action={formAction}>
          <SubmitButton pendingLabel={d.claiming}>{d.claim}</SubmitButton>
        </form>
      )}
      {state.error || state.ok ? <FormMessage state={state} className="basis-full" /> : null}
    </section>
  );
}
