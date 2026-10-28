import { Crosshair } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { HuntStatusBadge } from "@/components/hunts/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { huntStats } from "@/lib/calc/hunt";
import { formatDate, formatInteger, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { HuntForm } from "./hunt-form";

export const metadata: Metadata = { title: "Bonus Hunt" };

export default async function PanelHuntsPage() {
  await requirePanelProfile("mod");
  const supabase = await createClient();
  const [{ data: hunts, error }, { data: casinos }, { data: pending }] = await Promise.all([
    supabase
      .from("hunts")
      .select("id, title, status, currency, start_cost, final_balance, created_at, bonuses:hunt_bonuses(bet, payout)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("casinos").select("id, name").order("sort_order").order("name"),
    supabase.from("hunt_calls").select("hunt_id").eq("status", "pending"),
  ]);

  const pendingByHunt = new Map<string, number>();
  for (const call of pending ?? []) pendingByHunt.set(call.hunt_id, (pendingByHunt.get(call.hunt_id) ?? 0) + 1);

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">Bonus Hunt</h1>

      <section aria-labelledby="new-hunt" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="new-hunt" className="mb-3 font-semibold">
          Nuevo hunt
        </h2>
        <HuntForm casinos={casinos ?? []} />
        <p className="mt-2 text-xs text-subtle">
          Se crea como borrador: no se ve en la web hasta que cambies el estado.
        </p>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-live">
          No se pudieron cargar los hunts.
        </p>
      ) : !hunts?.length ? (
        <EmptyState icon={Crosshair} title="Sin hunts">
          Creá el primero con el formulario de arriba.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {hunts.map((hunt) => {
            const stats = huntStats(hunt.start_cost, hunt.bonuses);
            const calls = pendingByHunt.get(hunt.id) ?? 0;
            return (
              <li key={hunt.id}>
                <Link
                  href={`/panel/hunts/${hunt.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2"
                >
                  <span className="font-semibold">{hunt.title}</span>
                  <HuntStatusBadge status={hunt.status} />
                  {calls ? (
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
                      {formatInteger(calls)} {calls === 1 ? "call" : "calls"} por revisar
                    </span>
                  ) : null}
                  <span className="num ml-auto text-sm text-muted">
                    {formatInteger(stats.opened)}/{formatInteger(stats.bonuses)} bonos ·{" "}
                    {formatMoney(hunt.final_balance ?? stats.won, hunt.currency)}
                  </span>
                  <span className="text-xs text-subtle">{formatDate(hunt.created_at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
