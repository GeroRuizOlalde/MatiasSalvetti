"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DeleteAccountState = { error?: string };

const schema = z.object({
  confirm: z.literal("BORRAR", { error: "Escribí BORRAR para confirmar." }),
});

export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/entrar?next=/perfil");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (profile?.role === "admin") {
    return { error: "Una cuenta admin no se puede borrar desde acá. Pasale el rol a otra cuenta primero." };
  }

  // Borra el usuario de Auth; el perfil y sus datos se borran en cascada.
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) return { error: "No pudimos borrar la cuenta. Probá de nuevo o escribinos." };

  await supabase.auth.signOut();
  redirect("/?cuenta=borrada");
}
