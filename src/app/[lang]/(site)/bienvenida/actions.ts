"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { getActionMessages, getRequestLocale } from "@/i18n/server";
import { safeNext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type AcceptTermsState = { error?: string };

export async function acceptTerms(_prev: AcceptTermsState, formData: FormData): Promise<AcceptTermsState> {
  const [t, lang] = await Promise.all([getActionMessages(), getRequestLocale()]);
  const m = t.actions.terms;
  const parsed = z
    .object({
      adult: z.literal("on", { error: m.adult }),
      terms: z.literal("on", { error: m.accept }),
      version: z.coerce.number().int().positive(),
      next: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? m.check };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`${localePath(lang, "/entrar")}?next=${localePath(lang, "/bienvenida")}`);

  const { error } = await supabase.rpc("accept_terms", { p_version: parsed.data.version });
  if (error) {
    return { error: error.message.includes("terms_version_mismatch") ? m.changed : m.failed };
  }

  redirect(safeNext(parsed.data.next, localePath(lang, "/")));
}
