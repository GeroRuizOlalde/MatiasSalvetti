"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/i18n/config";
import { getActionMessages, getRequestLocale } from "@/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { VERIFICATIONS_BUCKET } from "@/lib/uploads";

export type DeleteAccountState = { error?: string };

export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const [t, lang] = await Promise.all([getActionMessages(), getRequestLocale()]);
  const m = t.actions.deleteAccount;
  const parsed = z
    .object({ confirm: z.literal(m.word, { error: m.typeWord }) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect(`${localePath(lang, "/entrar")}?next=${localePath(lang, "/perfil")}`);

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (profile?.role === "admin") {
    return { error: m.admin };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (configError) {
    // Sin SUPABASE_SECRET_KEY en el servidor no se pueden borrar usuarios de Auth.
    console.error("[borrar cuenta] falta configuración", configError);
    return { error: m.failed };
  }
  // Capturas de verificación: el storage no se borra en cascada con la base.
  const { data: files } = await admin.storage.from(VERIFICATIONS_BUCKET).list(userId, { limit: 1000 });
  if (files?.length) {
    await admin.storage.from(VERIFICATIONS_BUCKET).remove(files.map((f) => `${userId}/${f.name}`));
  }

  // Borra el usuario de Auth; el perfil y sus datos se borran en cascada.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[borrar cuenta] no se pudo borrar el usuario", error.message);
    return { error: m.failed };
  }

  await supabase.auth.signOut();
  redirect(`${localePath(lang, "/")}?cuenta=borrada`);
}
