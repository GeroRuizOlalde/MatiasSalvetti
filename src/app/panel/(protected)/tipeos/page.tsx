import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { formatDate, formatInteger, formatMulti } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tipeos" };

export default async function PanelTipeosPage() {
  await requirePanelProfile("mod");
  const supabase = await createClient();
  const { data: tipeos, error } = await supabase
    .from("tipeos")
    .select(
      "id, slot_name, ref_multi, ref_source, ref_title, user_id, created_at, hunt:hunts(id, title), bonus:hunt_bonuses!tipeos_bonus_id_fkey(multi)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = [...new Set((tipeos ?? []).map((t) => t.user_id).filter((u): u is string => Boolean(u)))];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, display_name, twitch_login").in("id", ids)
    : { data: [] };
  const nameOf = (userId: string | null) => {
    const p = people?.find((x) => x.id === userId);
    return p?.display_name || p?.twitch_login || "Viewer";
  };

  const opened = (tipeos ?? []).filter((t) => t.bonus?.multi != null);
  const best = opened.reduce<number | null>((max, t) => Math.max(max ?? 0, t.bonus?.multi ?? 0), null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide uppercase">Tipeos</h1>
        <p className="text-sm text-muted">
          Calls de slots que ya habían pagado más de 110x y se aceptaron como tipeo. Se marcan solos en «Calls por
          revisar» de cada hunt.
        </p>
      </div>

      {tipeos?.length ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Tipeos aceptados", value: formatInteger(tipeos.length) },
            { label: "Ya abiertos", value: formatInteger(opened.length) },
            { label: "Mejor resultado", value: best !== null ? formatMulti(best) : "—" },
          ].map((fact) => (
            <div key={fact.label} className="rounded-2xl border border-line bg-surface px-4 py-3">
              <dt className="text-xs text-subtle">{fact.label}</dt>
              <dd className="num text-2xl font-semibold text-gold">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-live">
          No se pudieron cargar los tipeos.
        </p>
      ) : !tipeos?.length ? (
        <EmptyState icon={Sparkles} title="Todavía no hay tipeos">
          Cuando un viewer pida un slot que ya pagó más de 110x, vas a ver «Aceptar tipeo» en los calls del hunt.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {tipeos.map((tipeo) => {
            const result = tipeo.bonus?.multi;
            return (
              <li key={tipeo.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{tipeo.slot_name}</p>
                  <p className="text-xs text-subtle">
                    {nameOf(tipeo.user_id)} · {formatDate(tipeo.created_at)}
                    {tipeo.hunt ? (
                      <>
                        {" · "}
                        <Link href={`/panel/hunts/${tipeo.hunt.id}`} className="hover:text-text hover:underline">
                          {tipeo.hunt.title}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <p className="text-xs text-muted">
                  Antes: <span className="num font-semibold text-gold">{formatMulti(tipeo.ref_multi)}</span> en{" "}
                  {tipeo.ref_source === "hunt" ? "el hunt" : "los buys"} «{tipeo.ref_title}»
                </p>
                <span
                  className={
                    result == null
                      ? "rounded-full bg-surface-2 px-2 py-0.5 text-xs text-subtle"
                      : "num rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold"
                  }
                >
                  {result == null ? "Sin abrir" : `Pagó ${formatMulti(result)}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
