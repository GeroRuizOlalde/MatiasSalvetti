import { Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePanelProfile } from "@/lib/auth/session";
import { formatDate, formatInteger } from "@/lib/format";
import { BATTLE_STATUSES, statusInfo } from "@/lib/session-status";
import { createClient } from "@/lib/supabase/server";
import { BattleForm } from "./forms";
import { casinoOptions } from "@/lib/panel-casinos";

export const metadata: Metadata = { title: "Bonus Battle" };

export default async function PanelBattlesPage() {
  await requirePanelProfile("mod");
  const supabase = await createClient();
  const [{ data: battles, error }, { data: casinos }] = await Promise.all([
    supabase
      .from("battles")
      .select("id, title, status, created_at, entries:battle_entries!battle_entries_battle_id_fkey(id)")
      .order("created_at", { ascending: false })
      .limit(100),
    casinoOptions(supabase),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">Bonus Battle</h1>

      <section aria-labelledby="new-battle" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="new-battle" className="mb-3 font-semibold">
          Nueva battle
        </h2>
        <BattleForm casinos={casinos ?? []} />
        <p className="mt-2 text-xs text-subtle">
          Se crea como borrador. Elegí desde qué instancia arranca y pasala a «Calls abiertos» para que los viewers
          callean su slot.
        </p>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-live">
          No se pudieron cargar las battles.
        </p>
      ) : !battles?.length ? (
        <EmptyState icon={Swords} title="Sin battles">
          Creá la primera con el formulario de arriba.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {battles.map((battle) => {
            const status = statusInfo(BATTLE_STATUSES, battle.status);
            return (
              <li key={battle.id}>
                <Link
                  href={`/panel/battles/${battle.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2"
                >
                  <span className="font-semibold">{battle.title}</span>
                  <StatusPill label={status.label} tone={status.tone} />
                  <span className="num ml-auto text-sm text-muted">{formatInteger(battle.entries.length)} slots</span>
                  <span className="text-xs text-subtle">{formatDate(battle.created_at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
