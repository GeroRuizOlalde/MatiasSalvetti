import { AgeGate } from "@/components/layout/age-gate";
import { Footer } from "@/components/layout/footer";
import { Header, TopBar } from "@/components/layout/header";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-accent px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>
      <TopBar />
      <Header />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <Footer />
      <AgeGate />
    </>
  );
}
