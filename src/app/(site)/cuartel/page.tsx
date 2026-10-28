import { Coins, Gift, History, Package, Sparkles, Target, Ticket, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/panel/action-button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentProfile, needsOnboarding, type CurrentProfile } from "@/lib/auth/session";
import { levelFromXp } from "@/lib/calc/levels";
import { cn } from "@/lib/cn";
import { getMissions, getShopItems, getXpLeaders, type PublicMission, type ShopItem } from "@/lib/cuartel";
import { formatDateTime, formatInteger } from "@/lib/format";
import { getLegalDocument } from "@/lib/legal";
import { POINT_KIND_LABEL, REWARD_KINDS } from "@/lib/rewards";
import { getPublicSettings } from "@/lib/settings";
import { publicAssetUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { buyItem } from "./actions";
import { MissionForm } from "./mission-form";

export const metadata: Metadata = {
  title: "Cuartel",
  description: "Tus puntos, nivel, misiones y la tienda.",
  robots: { index: false },
};

const TODAY_AR = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

export default function CuartelPage() {
  return (
    <>
      <PageHeader kicker="tu base" title="Cuartel">
        Sumá XP y puntos participando en los streams, cumplí misiones y canjeá premios en la tienda.
      </PageHeader>
      <div className="mx-auto max-w-7xl px-4 pb-16">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface" />}>
          <CuartelContent />
        </Suspense>
      </div>
    </>
  );
}

async function CuartelContent() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar?next=/cuartel");

  const supabase = await createClient();
  const [settings, terms, missions, items, leaders, claims, orders, events, canParticipate, redeemed] =
    await Promise.all([
      getPublicSettings(),
      getLegalDocument("terms"),
      getMissions(),
      getShopItems(),
      getXpLeaders(),
      supabase.from("mission_claims").select("mission_id, claim_key").eq("user_id", profile.id),
      supabase
        .from("shop_orders")
        .select("id, item_title, cost, status, note, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("point_events")
        .select("id, kind, points, xp, note, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.rpc("can_participate"),
      supabase.from("shop_orders").select("item_id").eq("user_id", profile.id).neq("status", "cancelled"),
    ]);

  const progress = levelFromXp(profile.xp, settings.level_curve);
  const blocked = needsOnboarding(profile, terms?.version ?? null) || !canParticipate.data;
  const today = TODAY_AR();
  const claimed = (mission: PublicMission) =>
    (claims.data ?? []).some(
      (c) => c.mission_id === mission.id && c.claim_key === (mission.type === "daily" ? today : "once"),
    );
  const orderCount = (item: ShopItem) => (redeemed.data ?? []).filter((o) => o.item_id === item.id).length;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-8">
        <ProfileCard profile={profile} progress={progress} />

        {blocked ? (
          <p className="rounded-xl border border-gold/40 bg-gold/5 px-4 py-3 text-sm">
            Para reclamar misiones y canjear premios tenés que{" "}
            <Link href="/bienvenida?next=/cuartel" className="font-semibold text-gold underline">
              confirmar tu edad y aceptar las bases
            </Link>{" "}
            (y que tu cuenta de Twitch cumpla la antigüedad mínima).
          </p>
        ) : null}

        <section aria-labelledby="missions-title">
          <h2
            id="missions-title"
            className="mb-3 flex items-center gap-2 font-display text-3xl tracking-wide uppercase"
          >
            <Target className="size-6 text-accent-text" aria-hidden /> Misiones
          </h2>
          {missions.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {missions.map((mission) => {
                const done = claimed(mission);
                return (
                  <li key={mission.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
                    <div>
                      <p className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{mission.title}</span>
                        <span className="text-xs text-subtle">
                          {mission.type === "daily"
                            ? "Diaria"
                            : mission.type === "code"
                              ? "Palabra secreta"
                              : "Una vez"}
                        </span>
                      </p>
                      {mission.description ? <p className="mt-1 text-sm text-muted">{mission.description}</p> : null}
                      <p className="num mt-2 text-xs text-gold">
                        +{formatInteger(mission.points)} puntos · +{formatInteger(mission.xp)} XP
                      </p>
                    </div>
                    {done ? (
                      <p className="text-sm font-semibold text-accent-text">
                        {mission.type === "daily" ? "Ya la reclamaste hoy ✓" : "Cumplida ✓"}
                      </p>
                    ) : blocked ? null : (
                      <MissionForm missionId={mission.id} type={mission.type} url={mission.url} />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Target} title="Sin misiones por ahora">
              Pronto vas a tener misiones para sumar puntos extra.
            </EmptyState>
          )}
        </section>

        <section aria-labelledby="shop-title">
          <h2 id="shop-title" className="mb-3 flex items-center gap-2 font-display text-3xl tracking-wide uppercase">
            <Gift className="size-6 text-accent-text" aria-hidden /> Tienda
          </h2>
          {items.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const image = publicAssetUrl(item.image_path);
                const soldOut = item.stock !== null && item.stock <= 0;
                const limitReached = item.per_user_limit !== null && orderCount(item) >= item.per_user_limit;
                const reason = soldOut
                  ? "Agotado"
                  : limitReached
                    ? "Ya lo canjeaste"
                    : profile.level < item.min_level
                      ? `Desde nivel ${item.min_level}`
                      : profile.points < item.cost
                        ? `Te faltan ${formatInteger(item.cost - profile.points)} puntos`
                        : null;
                return (
                  <li key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
                    {image ? (
                      <Image src={image} alt="" width={480} height={270} className="aspect-video w-full object-cover" />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-surface-2">
                        {item.kind === "tickets" ? (
                          <Ticket className="size-10 text-gold" aria-hidden />
                        ) : (
                          <Package className="size-10 text-accent-text" aria-hidden />
                        )}
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <p className="font-semibold">{item.title}</p>
                      {item.description ? <p className="text-sm text-muted">{item.description}</p> : null}
                      <p className="num text-sm text-subtle">
                        {item.stock !== null ? `${formatInteger(item.stock)} disponibles` : "Sin límite de stock"}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                        <span className="num flex items-center gap-1 font-bold text-gold">
                          <Coins className="size-4" aria-hidden /> {formatInteger(item.cost)}
                        </span>
                        {reason || blocked ? (
                          <span className="text-xs text-subtle">{reason}</span>
                        ) : (
                          <ActionButton
                            action={buyItem}
                            fields={{ item_id: item.id }}
                            variant="primary"
                            pendingLabel="Canjeando…"
                            confirmText={`¿Canjear «${item.title}» por ${formatInteger(item.cost)} puntos?`}
                          >
                            Canjear
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Gift} title="La tienda abre pronto">
              Andá juntando puntos.
            </EmptyState>
          )}
        </section>

        {orders.data?.length ? (
          <section aria-labelledby="orders-title">
            <h2 id="orders-title" className="mb-3 font-display text-2xl tracking-wide uppercase">
              Mis canjes
            </h2>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
              {orders.data.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <span className="font-semibold">{order.item_title}</span>
                  <span className="num text-xs text-subtle">{formatInteger(order.cost)} puntos</span>
                  <span
                    className={cn(
                      "ml-auto text-xs font-semibold",
                      order.status === "pending" && "text-gold",
                      order.status === "delivered" && "text-emerald-400",
                      order.status === "cancelled" && "text-live",
                    )}
                  >
                    {order.status === "pending"
                      ? "Pendiente de entrega"
                      : order.status === "delivered"
                        ? "Entregado"
                        : "Cancelado (puntos devueltos)"}
                  </span>
                  {order.note ? <span className="w-full text-xs text-muted">{order.note}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="history-title">
          <h2 id="history-title" className="mb-3 flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
            <History className="size-5 text-accent-text" aria-hidden /> Historial
          </h2>
          {events.data?.length ? (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
              {events.data.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    {POINT_KIND_LABEL[event.kind] ?? event.kind}
                    {event.note ? <span className="text-subtle"> · {event.note}</span> : null}
                  </span>
                  <span
                    className={cn("num w-20 text-right font-semibold", event.points >= 0 ? "text-gold" : "text-live")}
                  >
                    {event.points > 0 ? "+" : ""}
                    {formatInteger(event.points)}
                  </span>
                  <span className="num w-16 text-right text-xs text-accent-text">
                    {event.xp ? `+${formatInteger(event.xp)} XP` : ""}
                  </span>
                  <span className="w-28 text-right text-xs text-subtle">{formatDateTime(event.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">
              Todavía no sumaste puntos. Participá en el próximo stream.
            </p>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <section aria-labelledby="earn-title" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="earn-title" className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
            <Sparkles className="size-5 text-gold" aria-hidden /> Cómo sumar
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {REWARD_KINDS.map((reward) => (
              <li key={reward.key}>
                <p className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{reward.label}</span>
                  <span className="num text-xs text-gold">
                    +{formatInteger(settings.rewards[reward.key].points)} ·{" "}
                    {formatInteger(settings.rewards[reward.key].xp)} XP
                  </span>
                </p>
                <p className="text-xs text-subtle">{reward.description}</p>
              </li>
            ))}
          </ul>
        </section>

        {leaders.length ? (
          <section aria-labelledby="leaders-title" className="rounded-2xl border border-line bg-surface p-5">
            <h2 id="leaders-title" className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
              <Trophy className="size-5 text-gold" aria-hidden /> Top XP
            </h2>
            <ol className="mt-3 space-y-2 text-sm">
              {leaders.map((leader, i) => (
                <li
                  key={leader.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1",
                    leader.id === profile.id && "bg-accent/10",
                  )}
                >
                  <span className="num w-5 text-xs text-subtle">{i + 1}</span>
                  <Avatar url={leader.avatarUrl} name={leader.name} size={22} />
                  <span className="min-w-0 flex-1 truncate">{leader.name}</span>
                  <span className="num text-xs text-accent-text">Nv {leader.level}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function ProfileCard({ profile, progress }: { profile: CurrentProfile; progress: ReturnType<typeof levelFromXp> }) {
  const name = profile.display_name || profile.twitch_login || "Viewer";
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-accent/40 bg-[linear-gradient(135deg,rgb(157_59_255/0.12),transparent_60%)] p-6 sm:flex-row sm:items-center">
      <Avatar url={profile.avatar_url} name={name} size={72} />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="flex flex-wrap items-baseline gap-3">
          <span className="truncate font-display text-3xl tracking-wide uppercase">{name}</span>
          <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-bold text-white">
            Nivel {progress.level}
          </span>
        </p>
        <div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-label="Progreso al siguiente nivel"
            aria-valuemin={0}
            aria-valuemax={progress.xpForNext}
            aria-valuenow={progress.xpIntoLevel}
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.round(progress.progress * 100)}%` }}
            />
          </div>
          <p className="num mt-1 text-xs text-subtle">
            {formatInteger(progress.xpIntoLevel)} / {formatInteger(progress.xpForNext)} XP para el nivel{" "}
            {progress.level + 1}
          </p>
        </div>
      </div>
      <dl className="flex gap-3">
        <div className="rounded-xl bg-surface px-4 py-3 text-center">
          <dt className="flex items-center justify-center gap-1 text-xs text-subtle">
            <Coins className="size-3.5" aria-hidden /> Puntos
          </dt>
          <dd className="num text-2xl font-bold text-gold">{formatInteger(profile.points)}</dd>
        </div>
        <div className="rounded-xl bg-surface px-4 py-3 text-center">
          <dt className="flex items-center justify-center gap-1 text-xs text-subtle">
            <Ticket className="size-3.5" aria-hidden /> Tickets
          </dt>
          <dd className="num text-2xl font-bold text-gold">{formatInteger(profile.tickets)}</dd>
        </div>
      </dl>
    </section>
  );
}
