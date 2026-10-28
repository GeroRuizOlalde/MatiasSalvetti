import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = {
  title: "Cuartel",
  description: "Tus puntos, nivel, misiones y la tienda.",
};

export default function Page() {
  return <ComingSoon title="Cuartel" description="Tus puntos, nivel, misiones y la tienda." />;
}
