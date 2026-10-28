import type { Metadata } from "next";
import { requirePanelProfile } from "@/lib/auth/session";
import { formatDateTime, formatInteger, toArgentinaInput } from "@/lib/format";
import { getPublicSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { AdjustForm, MissionForm, OrderForm, RewardsForm, ShopItemForm } from "./forms";

export const metadata: Metadata = { title: "Puntos y misiones" };

const MISSION_TYPE = { daily: "Diaria", code: "Palabra secreta", link: "Link" } as const;

export default async function PuntosPage() {
  await requirePanelProfile("admin");
  const supabase = await createClient();
  const [settings, { data: missions }, { data: codes }, { data: items }, { data: orders }] = await Promise.all([
    getPublicSettings(),
    supabase
      .from("missions")
      .select("id, title, description, type, points, xp, url, starts_at, ends_at, is_active, sort_order, updated_at")
      .order("sort_order")
      .order("created_at"),
    supabase.from("mission_codes").select("mission_id, code"),
    supabase
      .from("shop_items")
      .select(
        "id, title, description, kind, tickets, cost, stock, per_user_limit, min_level, is_active, sort_order, image_path, updated_at",
      )
      .order("sort_order")
      .order("cost"),
    supabase
      .from("shop_orders")
      .select("id, item_title, cost, created_at, user:profiles!shop_orders_user_id_fkey(display_name, twitch_login)")
      .eq("status", "pending")
      .order("created_at"),
  ]);

  return (
    <div className="max-w-6xl space-y-8">
      <h1 className="font-display text-4xl tracking-wide uppercase">Puntos y misiones</h1>

      <section aria-labelledby="orders" className="space-y-3">
        <h2 id="orders" className="font-semibold">
          Canjes por entregar{" "}
          <span className="num text-sm font-normal text-subtle">({formatInteger(orders?.length ?? 0)})</span>
        </h2>
        {orders?.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{order.item_title}</p>
                  <p className="text-xs text-subtle">
                    {order.user?.display_name || order.user?.twitch_login || "Viewer"}
                    {order.user?.twitch_login ? ` (twitch.tv/${order.user.twitch_login})` : ""} ·{" "}
                    {formatInteger(order.cost)} puntos · {formatDateTime(order.created_at)}
                  </p>
                </div>
                <OrderForm orderId={order.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">
            No hay canjes pendientes.
          </p>
        )}
      </section>

      <section aria-labelledby="rewards" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="rewards" className="mb-1 font-semibold">
          Premios por participar
        </h2>
        <p className="mb-4 text-sm text-muted">
          Se suman solos. Cada cosa paga una sola vez aunque se reabra un hunt o una votación.
        </p>
        <RewardsForm rewards={settings.rewards} />
      </section>

      <section aria-labelledby="missions" className="space-y-3">
        <h2 id="missions" className="font-semibold">
          Misiones
        </h2>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <MissionForm />
        </div>
        {missions?.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {missions.map((mission) => (
              <li key={mission.id}>
                <details className="group px-4 py-3">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={mission.is_active ? "font-semibold" : "font-semibold text-subtle line-through"}>
                      {mission.title}
                    </span>
                    <span className="text-xs text-subtle">{MISSION_TYPE[mission.type]}</span>
                    <span className="num text-xs text-gold">
                      +{formatInteger(mission.points)} · {formatInteger(mission.xp)} XP
                    </span>
                    <span className="ml-auto text-xs text-subtle group-open:hidden">Editar</span>
                  </summary>
                  <div className="mt-3">
                    <MissionForm
                      key={mission.updated_at}
                      mission={{
                        ...mission,
                        code: codes?.find((c) => c.mission_id === mission.id)?.code ?? null,
                        startsAt: mission.starts_at ? toArgentinaInput(mission.starts_at) : "",
                        endsAt: mission.ends_at ? toArgentinaInput(mission.ends_at) : "",
                      }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="shop" className="space-y-3">
        <h2 id="shop" className="font-semibold">
          Tienda
        </h2>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <ShopItemForm />
        </div>
        {items?.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {items.map((item) => (
              <li key={item.id}>
                <details className="group px-4 py-3">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={item.is_active ? "font-semibold" : "font-semibold text-subtle line-through"}>
                      {item.title}
                    </span>
                    <span className="text-xs text-subtle">
                      {item.kind === "tickets" ? `${item.tickets} tickets` : "Premio"}
                    </span>
                    <span className="num text-xs text-gold">{formatInteger(item.cost)} puntos</span>
                    <span className="num text-xs text-subtle">
                      {item.stock !== null ? `stock ${formatInteger(item.stock)}` : "sin límite"}
                    </span>
                    <span className="ml-auto text-xs text-subtle group-open:hidden">Editar</span>
                  </summary>
                  <div className="mt-3">
                    <ShopItemForm key={item.updated_at} item={item} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="adjust" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="adjust" className="mb-1 font-semibold">
          Ajuste manual
        </h2>
        <p className="mb-4 text-sm text-muted">
          Para premiar algo fuera de la web o corregir un error. Queda en el historial del viewer.
        </p>
        <AdjustForm />
      </section>
    </div>
  );
}
