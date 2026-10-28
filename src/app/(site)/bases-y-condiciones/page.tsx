import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Bases y condiciones",
  description: "Bases y condiciones para participar en las dinámicas de la comunidad.",
};

export default function Page() {
  return <LegalPage kind="terms" fallbackTitle="Bases y condiciones" />;
}
