import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = {
  title: "Wager Race",
  description: "El ranking mensual de wager con premios para la comunidad.",
};

export default function Page() {
  return <ComingSoon title="Wager Race" description="El ranking mensual de wager con premios para la comunidad." />;
}
