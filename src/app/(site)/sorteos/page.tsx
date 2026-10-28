import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = {
  title: "Sorteos",
  description: "Sorteos activos y terminados para la comunidad.",
};

export default function Page() {
  return <ComingSoon title="Sorteos" description="Sorteos activos y terminados para la comunidad." />;
}
