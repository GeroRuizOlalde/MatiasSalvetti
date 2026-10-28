"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type AcceptTermsState = { error?: string };

const schema = z.object({
  adult: z.literal("on", { error: "Tenés que confirmar que sos mayor de 18." }),
  terms: z.literal("on", { error: "Tenés que aceptar las bases y condiciones." }),
  version: z.coerce.number().int().positive(),
  next: z.string().optional(),
});

export async function acceptTerms(_prev: AcceptTermsState, formData: FormData): Promise<AcceptTermsState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá el formulario." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/entrar?next=/bienvenida");

  const { error } = await supabase.rpc("accept_terms", { p_version: parsed.data.version });
  if (error) {
    return {
      error: error.message.includes("terms_version_mismatch")
        ? "Las bases cambiaron mientras leías. Recargá la página y aceptá la versión nueva."
        : "No pudimos guardar tu confirmación. Probá de nuevo.",
    };
  }

  redirect(safeNext(parsed.data.next));
}
