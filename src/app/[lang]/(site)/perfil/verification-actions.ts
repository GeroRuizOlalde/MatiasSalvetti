"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getActionMessages } from "@/i18n/server";
import type { ActionState } from "@/lib/action-state";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasFile, uploadVerificationScreenshot, VERIFICATIONS_BUCKET } from "@/lib/uploads";
import { viewerError } from "@/lib/viewer-actions";

export async function submitVerification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionMessages();
  const a = t.actions;
  const parsed = z
    .object({
      casino_id: z.uuid({ error: a.pickCasino }),
      account_id: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9._@-]{3,64}$/, a.verification.invalid_account_id),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? a.checkData };
  const file = formData.get("screenshot");
  if (!hasFile(file)) return { error: a.screenshotRequired };

  const profile = await getCurrentProfile();
  if (!profile) return { error: viewerError(t, "not_authenticated") };

  const supabase = await createClient();
  const { data: casino } = await supabase
    .from("casinos")
    .select("slug")
    .eq("id", parsed.data.casino_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!casino) return { error: a.verification.invalid_casino };

  const upload = await uploadVerificationScreenshot(supabase, profile.id, casino.slug, file, {
    type: a.screenshotType,
    size: a.screenshotSize,
    upload: a.screenshotUpload,
  });
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
    return { error: viewerError(t, error.message, a.verification) };
  }
  refresh();
  return { ok: a.verificationSent };
}
