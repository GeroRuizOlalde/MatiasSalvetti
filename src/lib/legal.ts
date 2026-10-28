import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Enums, Tables } from "@/types/database";

export const LEGAL_TAG = "legal-documents";

export type LegalDocument = Pick<Tables<"legal_documents">, "kind" | "version" | "title" | "content_md" | "published_at">;

/** Última versión publicada de un documento legal, o null si no hay. */
export async function getLegalDocument(kind: Enums<"legal_kind">): Promise<LegalDocument | null> {
  "use cache";
  cacheTag(LEGAL_TAG);
  cacheLife("hours");

  const supabase = createPublicClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("legal_documents")
    .select("kind, version, title, content_md, published_at")
    .eq("kind", kind)
    .not("published_at", "is", null) // RLS ya filtra las versiones con fecha futura
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
