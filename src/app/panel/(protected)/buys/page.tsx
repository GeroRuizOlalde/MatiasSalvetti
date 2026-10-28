import { ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePanelProfile } from "@/lib/auth/session";
import { buysStats } from "@/lib/calc/buys";
import { formatDate, formatInteger, formatMoney } from "@/lib/format";
import { BUY_STATUSES, statusInfo } from "@/lib/session-status";
import { createClient } from "@/lib/supabase/server";
import { BuySessionForm } from "./forms";

export const metadata: Metadata = { title: "Bonus Buys" };

export default async function PanelBuysPage() {
  await requirePanelProfile("mod");
  const supabase = await createClient();
  const [{ data: sessions, error }, { data: casinos }] = await Promise.all([
    supabase
      .from("buy_sessions")
      .select("id, title, status, currency, created_at, buys(bet, cost, payout)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("casinos").select("id, name").order("sort_order").order("name"),
  ]);

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">Bonus Buys</h1>

      <section aria-labelledby="new-session" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="new-session" className="mb-3 font-semibold">
          Nueva sesión
        </h2>
        <BuySessionForm casinos={casinos ?? []} />
        <p className="mt-2 text-xs text-subtle">
          Se crea como borrador: no se ve en la web hasta que la pongas «En vivo».
        </p>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-live">
          No se pudieron cargar las sesiones.
        </p>
      ) : !sessions?.length ? (
        <EmptyState icon={ShoppingCart} title="Sin sesiones">
          Creá la primera con el formulario de arriba.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {sessions.map((session) => {
            const stats = buysStats(session.buys);
            const status = statusInfo(BUY_STATUSES, session.status);
            return (
              <li key={session.id}>
                <Link
                  href={`/panel/buys/${session.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2"
                >
                  <span className="font-semibold">{session.title}</span>
                  <StatusPill label={status.label} tone={status.tone} />
                  <span className="num ml-auto text-sm text-muted">
                    {formatInteger(stats.buys)} compras · {formatMoney(stats.profit, session.currency)}
                  </span>
                  <span className="text-xs text-subtle">{formatDate(session.created_at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
