"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasFile, uploadVerificationScreenshot, VERIFICATIONS_BUCKET } from "@/lib/uploads";
import { viewerError } from "@/lib/viewer-actions";

const ERRORS: Record<string, string> = {
  invalid_casino: "Elegí un casino de la lista.",
  invalid_account_id: "El ID de cuenta tiene que tener entre 3 y 64 letras o números.",
  invalid_screenshot: "Subí la captura de nuevo.",
  already_verified: "Esa cuenta ya está verificada.",
  account_taken: "Esa cuenta de casino ya está cargada por otro usuario. Si es tuya, escribinos.",
};

const schema = z.object({
  casino_id: z.uuid({ error: "Elegí un casino." }),
  account_id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._@-]{3,64}$/, ERRORS.invalid_account_id),
});

export async function submitVerification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const file = formData.get("screenshot");
  if (!hasFile(file)) return { error: "Subí una captura donde se vea tu ID de cuenta." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: viewerError("not_authenticated") };

  const supabase = await createClient();
  const { data: casino } = await supabase
    .from("casinos")
    .select("slug")
    .eq("id", parsed.data.casino_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!casino) return { error: ERRORS.invalid_casino };

  const upload = await uploadVerificationScreenshot(supabase, profile.id, casino.slug, file);
  if ("error" in upload) return upload;

  const { error } = await supabase.rpc("submit_casino_account", {
    p_casino: parsed.data.casino_id,
    p_account_id: parsed.data.account_id,
    p_screenshot_path: upload.path,
  });
  if (error) {
    // La captura quedó sin usar. Los viewers no pueden borrar en el bucket: se borra con la secret key.
    try {
      await createAdminClient().storage.from(VERIFICATIONS_BUCKET).remove([upload.path]);
    } catch (cleanupError) {
      console.error("[verificación] no se pudo borrar la captura", cleanupError);
    }
    return { error: viewerError(error.message, ERRORS) };
  }
  refresh();
  return { ok: "¡Listo! Un admin va a revisar tu cuenta. Te avisamos acá y en tu perfil." };
}
