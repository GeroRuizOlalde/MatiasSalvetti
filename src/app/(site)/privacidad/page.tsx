import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos guardamos y para qué.",
};

export default function Page() {
  return <LegalPage kind="privacy" fallbackTitle="Política de privacidad" />;
}
