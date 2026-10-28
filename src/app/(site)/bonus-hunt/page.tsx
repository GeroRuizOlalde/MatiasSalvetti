import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = {
  title: "Bonus Hunt",
  description: "Seguí cada hunt en vivo: bonos, balance, calls y adiviná el balance.",
};

export default function Page() {
  return <ComingSoon title="Bonus Hunt" description="Seguí cada hunt en vivo: bonos, balance, calls y adiviná el balance." />;
}
