import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Juego responsable",
  description: "Información sobre juego responsable y dónde pedir ayuda.",
};

export default function Page() {
  return <LegalPage kind="responsible_gaming" fallbackTitle="Juego responsable" />;
}
