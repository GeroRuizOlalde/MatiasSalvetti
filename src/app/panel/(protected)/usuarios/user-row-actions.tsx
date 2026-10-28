"use client";

import { useActionState, useId } from "react";
import { buttonClasses } from "@/components/ui/button";
import type { Enums } from "@/types/database";
import { setUserBan, setUserRole, type UserActionState } from "./actions";

const fieldClass = "h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-text";

export function UserRowActions({
  userId,
  role,
  banned,
  displayName,
}: {
  userId: string;
  role: Enums<"user_role">;
  banned: boolean;
  displayName: string;
}) {
  const [roleState, roleAction, rolePending] = useActionState<UserActionState, FormData>(setUserRole, {});
  const [banState, banAction, banPending] = useActionState<UserActionState, FormData>(setUserBan, {});
  const roleId = useId();
  const reasonId = useId();
  const message = roleState.error ?? banState.error ?? roleState.ok ?? banState.ok;
  const isError = Boolean(roleState.error ?? banState.error);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={roleAction} className="flex items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <label htmlFor={roleId} className="sr-only">
          Rol de {displayName}
        </label>
        <select id={roleId} name="role" defaultValue={role} className={fieldClass}>
          <option value="viewer">Viewer</option>
          <option value="mod">Mod</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={rolePending} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          Guardar rol
        </button>
      </form>

      <form action={banAction} className="flex items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="banned" value={banned ? "false" : "true"} />
        {!banned ? (
          <>
            <label htmlFor={reasonId} className="sr-only">
              Motivo del baneo de {displayName}
            </label>
            <input id={reasonId} name="reason" placeholder="Motivo" maxLength={200} className={`${fieldClass} w-36`} />
          </>
        ) : null}
        <button
          type="submit"
          disabled={banPending}
          className={buttonClasses({ variant: banned ? "secondary" : "ghost", size: "sm", className: banned ? "" : "text-live" })}
        >
          {banned ? "Desbanear" : "Banear"}
        </button>
      </form>

      {message ? (
        <p aria-live="polite" className={isError ? "text-xs text-live" : "text-xs text-accent-text"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
