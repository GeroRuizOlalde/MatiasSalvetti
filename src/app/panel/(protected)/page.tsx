import { Crosshair, Inbox, Megaphone, Radio, ShoppingCart, Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { isSupabaseConfigured } from "@/lib/env";
import { formatInteger } from "@/lib/format";
import { getPublicSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { StreamStatusForm } from "./stream-status-form";

export const metadata: Metadata = { title: "Inicio" };

const QUICK_ACTIONS = [
  { label: "Nuevo Bonus Hunt", icon: Crosshair, href: "/panel/hunts" },
  { label: "Nueva sesión de Buys", icon: ShoppingCart, href: "/panel/buys" },
  { label: "Nueva Battle", icon: Swords, href: "/panel/battles" },
];

export default async function PanelHomePage() {
  const supabase = isSupabaseConfigured() ? await createClient() : null;
  const [settings, pendingCalls] = await Promise.all([
    getPublicSettings(),
    supabase
      ?.from("hunt_calls")
      .select("hunt_id, hunt:hunts(title)")
      .eq("status", "pending")
      .then((r) => r.data),
  ]);

  const pendingByHunt = new Map<string, { title: string; count: number }>();
  for (const call of pendingCalls ?? []) {
    const entry = pendingByHunt.get(call.hunt_id) ?? { title: call.hunt?.title ?? "Hunt", count: 0 };
    entry.count += 1;
    pendingByHunt.set(call.hunt_id, entry);
  }

  return (
    <div className="max-w-5xl space-y-8">
      <h1 className="font-display text-4xl tracking-wide uppercase">Inicio</h1>

      <section aria-labelledby="quick">
        <h2 id="quick" className="mb-3 text-sm font-semibold text-subtle">
          Accesos rápidos
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
            <li key={label}>
              <Link
                href={href}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-accent/60"
              >
                <Icon className="size-5 text-accent-text" aria-hidden />
                <span className="text-sm font-semibold">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pending">
        <h2 id="pending" className="mb-3 text-sm font-semibold text-subtle">
          Pendientes
        </h2>
        {pendingByHunt.size ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {[...pendingByHunt].map(([huntId, { title, count }]) => (
              <li key={huntId}>
                <Link href={`/panel/hunts/${huntId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <Megaphone className="size-4 text-gold" aria-hidden />
                  <span className="text-sm">
                    <span className="num font-semibold text-gold">{formatInteger(count)}</span>{" "}
                    {count === 1 ? "call por revisar" : "calls por revisar"} en <strong>{title}</strong>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Inbox} title="Nada pendiente">
            Acá vas a ver los calls por aceptar, las verificaciones y los sorteos a cerrar.
          </EmptyState>
        )}
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
