import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TipeoButtons } from "@/components/panel/tipeo-buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { formatDate, formatInteger, formatMoney, formatMulti } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { TIPEO_MIN_MULTI } from "@/lib/tipeos";

export const metadata: Metadata = { title: "Tipeos" };

export default async function PanelTipeosPage() {
  await requirePanelProfile("mod");
  const supabase = await createClient();
  const [{ data: tipeoRows, error }, { data: bonusHits }, { data: buyHits }] = await Promise.all([
    supabase
      .from("tipeos")
      .select(
        "id, bonus_id, buy_id, user_id, slot_name, bet, payout, multi, status, created_at, hunt:hunts(id, title, currency), session:buy_sessions(id, title, currency)",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    // Bonos y compras de calls que pasaron los 110x: los que no tienen decisión son las recomendaciones.
    supabase
      .from("hunt_bonuses")
      .select("id, called_by, slot_name, multi, opened_at, hunt:hunts(id, title)")
      .not("called_by", "is", null)
      .gt("multi", TIPEO_MIN_MULTI)
      .order("opened_at", { ascending: false })
      .limit(200),
    supabase
      .from("buys")
      .select("id, called_by, slot_name, multi, opened_at, session:buy_sessions(id, title)")
      .not("called_by", "is", null)
      .gt("multi", TIPEO_MIN_MULTI)
      .order("opened_at", { ascending: false })
      .limit(200),
  ]);

  // Hunts y buys en un mismo formato: de dónde viene y a qué página del panel lleva.
  const tipeos = (tipeoRows ?? []).map((t) => ({
    ...t,
    kind: t.buy_id ? ("buy" as const) : ("bonus" as const),
    targetId: (t.buy_id ?? t.bonus_id) as string,
    source: t.hunt
      ? { title: t.hunt.title, href: `/panel/hunts/${t.hunt.id}`, currency: t.hunt.currency }
      : t.session
        ? { title: t.session.title, href: `/panel/buys/${t.session.id}`, currency: t.session.currency }
        : null,
  }));
  const decided = new Set(tipeos.map((t) => t.targetId));
  const pending = [
    ...(bonusHits ?? []).map((b) => ({
      ...b,
      kind: "bonus" as const,
      source: b.hunt ? { title: b.hunt.title, href: `/panel/hunts/${b.hunt.id}` } : null,
    })),
    ...(buyHits ?? []).map((b) => ({
      ...b,
      kind: "buy" as const,
      source: b.session ? { title: b.session.title, href: `/panel/buys/${b.session.id}` } : null,
    })),
  ]
    .filter((b) => !decided.has(b.id))
    .sort((a, b) => (b.opened_at ?? "").localeCompare(a.opened_at ?? ""));
  const given = tipeos.filter((t) => t.status === "given");

  const ids = [...new Set([...given.map((t) => t.user_id), ...pending.map((b) => b.called_by)])].filter(
    (u): u is string => Boolean(u),
  );
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, display_name, twitch_login").in("id", ids)
    : { data: [] };
  const nameOf = (userId: string | null) => {
    const p = people?.find((x) => x.id === userId);
    return p?.display_name || p?.twitch_login || "Viewer";
  };

  // Ranking: cuántos tipeos lleva cada viewer.
  const byViewer = new Map<string, { count: number; best: number }>();
  for (const t of given) {
    const row = byViewer.get(t.user_id ?? "") ?? { count: 0, best: 0 };
    byViewer.set(t.user_id ?? "", { count: row.count + 1, best: Math.max(row.best, t.multi) });
  }
  const ranking = [...byViewer.entries()]
    .map(([userId, row]) => ({ userId, ...row }))
    .sort((a, b) => b.count - a.count || b.best - a.best)
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide uppercase">Tipeos</h1>
        <p className="text-sm text-muted">
          Cuando un bono (de un hunt o de buys) que vino del call de un viewer paga más de {TIPEO_MIN_MULTI}x, se
          recomienda darle tipeo. Acá ves los que faltan decidir y la lista de tipeos dados.
        </p>
      </div>

      {pending.length ? (
        <section aria-labelledby="pending" className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
          <h2 id="pending" className="mb-3 flex items-center gap-2 font-semibold text-gold">
            <Sparkles className="size-4" aria-hidden /> Por decidir ({formatInteger(pending.length)})
          </h2>
          <ul className="divide-y divide-gold/20">
            {pending.map((bonus) => (
              <li key={bonus.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{nameOf(bonus.called_by)}</p>
                  <p className="text-sm text-muted">
                    {bonus.slot_name} ·{" "}
                    <span className="num font-semibold text-gold">{formatMulti(bonus.multi ?? 0)}</span>
                    {bonus.source ? (
                      <>
                        {" · "}
                        <Link href={bonus.source.href} className="hover:text-text hover:underline">
                          {bonus.source.title}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <TipeoButtons kind={bonus.kind} id={bonus.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ranking.length ? (
        <section aria-labelledby="ranking">
          <h2 id="ranking" className="mb-3 font-semibold">
            Quién tiene más tipeos
          </h2>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {ranking.map((row, i) => (
              <li key={row.userId} className="rounded-2xl border border-line bg-surface px-4 py-3">
                <p className="text-xs text-subtle">#{i + 1}</p>
                <p className="truncate font-semibold">{nameOf(row.userId || null)}</p>
                <p className="num text-sm text-gold">
                  {formatInteger(row.count)} {row.count === 1 ? "tipeo" : "tipeos"} · mejor {formatMulti(row.best)}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="given">
        <h2 id="given" className="mb-3 font-semibold">
          Tipeos dados <span className="num text-sm font-normal text-subtle">({formatInteger(given.length)})</span>
        </h2>
        {error ? (
          <p role="alert" className="text-sm text-live">
            No se pudieron cargar los tipeos.
          </p>
        ) : !given.length ? (
          <EmptyState icon={Sparkles} title="Todavía no hay tipeos">
            Cuando abras un bono de un call que pague más de {TIPEO_MIN_MULTI}x, te lo vamos a recomendar acá y en el
            hunt.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {given.map((tipeo) => (
              <li key={tipeo.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{nameOf(tipeo.user_id)}</p>
                  <p className="text-xs text-subtle">
                    {tipeo.slot_name} · {formatDate(tipeo.created_at)}
                    {tipeo.source ? (
                      <>
                        {" · "}
                        <Link href={tipeo.source.href} className="hover:text-text hover:underline">
                          {tipeo.source.title}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <p className="num text-sm text-muted">
                  {formatMoney(tipeo.bet, tipeo.source?.currency ?? "ARS")} →{" "}
                  {formatMoney(tipeo.payout, tipeo.source?.currency ?? "ARS")}
                </p>
                <span className="num rounded-full bg-gold/15 px-2 py-0.5 text-sm font-semibold text-gold">
                  {formatMulti(tipeo.multi)}
                </span>
                <TipeoButtons kind={tipeo.kind} id={tipeo.targetId} given />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
