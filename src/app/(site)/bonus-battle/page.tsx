import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = {
  title: "Bonus Battle",
  description: "Slots cara a cara en eliminación directa. ¿A quién bancás?",
};

export default function Page() {
  return <ComingSoon title="Bonus Battle" description="Slots cara a cara en eliminación directa. ¿A quién bancás?" />;
}
