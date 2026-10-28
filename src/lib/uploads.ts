import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_ASSETS_BUCKET } from "@/lib/storage";
import type { Database } from "@/types/database";

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** Un <input type="file"> vacío llega como File de 0 bytes. */
export function hasFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

export function validateImage(file: File, maxBytes = 2 * 1024 * 1024): { ext: string } | { error: string } {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { error: "La imagen tiene que ser PNG, JPG, WebP o SVG." };
  if (file.size > maxBytes) return { error: `La imagen no puede pesar más de ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  return { ext };
}

/** Sube una imagen al bucket público y devuelve su ruta. */
export async function uploadPublicImage(
  supabase: SupabaseClient<Database>,
  folder: string,
  name: string,
  file: File,
): Promise<{ path: string } | { error: string }> {
  const check = validateImage(file);
  if ("error" in check) return check;
  // El timestamp evita que el CDN siga sirviendo la versión anterior.
  const path = `${folder}/${name}-${Date.now()}.${check.ext}`;
  const { error } = await supabase.storage
    .from(PUBLIC_ASSETS_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) return { error: "No se pudo subir la imagen." };
  return { path };
}
