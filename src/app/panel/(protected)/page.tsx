import { Crosshair, Inbox, Radio, ShoppingCart, Swords } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicSettings } from "@/lib/settings";
import { StreamStatusForm } from "./stream-status-form";

export const metadata: Metadata = { title: "Inicio" };

const QUICK_ACTIONS = [
  { label: "Nuevo Bonus Hunt", icon: Crosshair, phase: 3 },
  { label: "Nueva sesión de Buys", icon: ShoppingCart, phase: 4 },
  { label: "Nueva Battle", icon: Swords, phase: 4 },
];

export default async function PanelHomePage() {
  const settings = await getPublicSettings();

  return (
    <div className="max-w-5xl space-y-8">
      <h1 className="font-display text-4xl tracking-wide uppercase">Inicio</h1>

      <section aria-labelledby="quick">
        <h2 id="quick" className="mb-3 text-sm font-semibold text-subtle">
          Accesos rápidos
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {QUICK_ACTIONS.map(({ label, icon: Icon, phase }) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-surface/60 p-4 text-subtle"
            >
              <Icon className="size-5" aria-hidden />
              <span className="text-sm font-semibold">{label}</span>
              <span className="ml-auto text-[10px]">fase {phase}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pending">
        <h2 id="pending" className="mb-3 text-sm font-semibold text-subtle">
          Pendientes
        </h2>
        <EmptyState icon={Inbox} title="Nada pendiente">
          Acá vas a ver los calls por aceptar, las verificaciones y los sorteos a cerrar.
        </EmptyState>
      </section>

      <section aria-labelledby="stream" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="stream" className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
          <Radio className="size-5 text-live" aria-hidden /> Estado del stream
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Respaldo manual por si falla la detección automática de Twitch y Kick.
        </p>
        <StreamStatusForm
          live={settings.stream_manual.live}
          platform={settings.stream_manual.platform}
          nextAt={settings.next_stream.at}
          nextLabel={settings.next_stream.label}
        />
      </section>
    </div>
  );
}
