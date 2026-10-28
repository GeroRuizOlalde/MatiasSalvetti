import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = {
  title: "Bonus Buys",
  description: "Todas las compras de bonus, sesión por sesión.",
};

export default function Page() {
  return <ComingSoon title="Bonus Buys" description="Todas las compras de bonus, sesión por sesión." />;
}
