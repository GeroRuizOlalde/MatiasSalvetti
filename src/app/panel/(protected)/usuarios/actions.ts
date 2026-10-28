"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requirePanelProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type UserActionState = { error?: string; ok?: string };

const ERRORS: Record<string, string> = {
  cannot_change_own_role: "No podés cambiar tu propio rol.",
  cannot_ban_self: "No podés banearte a vos mismo.",
  forbidden: "No tenés permisos para esto.",
};

function friendly(message: string) {
  const key = Object.keys(ERRORS).find((k) => message.includes(k));
  return key ? ERRORS[key] : "No se pudo guardar. Probá de nuevo.";
}

const roleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["viewer", "mod", "admin"]),
});

export async function setUserRole(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  await requirePanelProfile("admin");
  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", { p_user: parsed.data.userId, p_role: parsed.data.role });
  if (error) return { error: friendly(error.message) };
  refresh();
  return { ok: "Rol actualizado." };
}

const banSchema = z.object({
  userId: z.uuid(),
  banned: z.enum(["true", "false"]),
  reason: z.string().trim().max(200).optional(),
});

export async function setUserBan(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  await requirePanelProfile("admin");
  const parsed = banSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_ban", {
    p_user: parsed.data.userId,
    p_banned: parsed.data.banned === "true",
    p_reason: parsed.data.reason,
  });
  if (error) return { error: friendly(error.message) };
  refresh();
  return { ok: parsed.data.banned === "true" ? "Usuario baneado." : "Baneo levantado." };
}
