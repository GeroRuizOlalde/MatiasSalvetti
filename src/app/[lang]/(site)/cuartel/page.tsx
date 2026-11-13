import type { Locale } from "@/i18n/config";
import { getI18n, pageLocale } from "@/i18n/server";
import { Award, Coins, Gift, History, Package, Sparkles, Target, Ticket, Trophy } from "lucide-react";
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
import { dailyBonusPoints, levelBadge } from "@/lib/points-config";
import { REWARD_KINDS } from "@/lib/rewards";
import { getPublicSettings } from "@/lib/settings";
import { publicAssetUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { buyItem } from "./actions";
import { DailyBonus } from "./daily-bonus";
import { MissionForm } from "./mission-form";

export async function generateMetadata({ params }: PageProps<"/[lang]/cuartel">): Promise<Metadata> {
  const { t } = getI18n(await pageLocale(params));
  return {
    title: t.hq.title,
    description: t.hq.metaDescription,
    robots: { index: false },
  };
}

const TODAY_AR = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());

/** El día anterior a una fecha `YYYY-MM-DD`. */
const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

export default async function CuartelPage({ params }: PageProps<"/[lang]/cuartel">) {
  const lang = await pageLocale(params);
  const { t } = getI18n(lang);
  return (
    <>
      <PageHeader kicker={t.hq.kicker} title={t.hq.title}>
        {t.hq.intro}
      </PageHeader>
      <div className="mx-auto max-w-7xl px-4 pb-16">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface" />}>
          <CuartelContent lang={lang} />
        </Suspense>
      </div>
    </>
  );
}

async function CuartelContent({ lang }: { lang: Locale }) {
  const { t, href } = getI18n(lang);
  const h = t.hq;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`${href("/entrar")}?next=${href("/cuartel")}`);

  const supabase = await createClient();
  const [settings, terms, missions, items, leaders, claims, orders, events, canParticipate, redeemed, daily] =
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
      supabase
        .from("profiles")
        .select("daily_streak, daily_last_claim, points_blocked_at")
        .eq("id", profile.id)
        .maybeSingle(),
    ]);

  const progress = levelFromXp(profile.xp, settings.level_curve);
  const blocked = needsOnboarding(profile, terms?.version ?? null) || !canParticipate.data;
  const today = TODAY_AR();
  // La racha sigue viva si reclamó hoy o ayer.
  const lastClaim = daily.data?.daily_last_claim ?? null;
  const claimedToday = lastClaim === today;
  const streak = claimedToday || lastClaim === dayBefore(today) ? (daily.data?.daily_streak ?? 0) : 0;
  const claimed = (mission: PublicMission) =>
    (claims.data ?? []).some(
      (c) => c.mission_id === mission.id && c.claim_key === (mission.type === "daily" ? today : "once"),
    );
  const orderCount = (item: ShopItem) => (redeemed.data ?? []).filter((o) => o.item_id === item.id).length;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-8">
        <ProfileCard profile={profile} progress={progress} lang={lang} />

        <DailyBonus
          streak={streak}
          claimedToday={claimedToday}
          nextPoints={dailyBonusPoints(settings.points_config, streak + 1)}
          disabled={blocked || Boolean(daily.data?.points_blocked_at)}
          pointsBlocked={Boolean(daily.data?.points_blocked_at)}
        />

        {blocked ? (
          <p className="rounded-xl border border-gold/40 bg-gold/5 px-4 py-3 text-sm">
            {h.blocked[0]}
            <Link
              href={`${href("/bienvenida")}?next=${href("/cuartel")}`}
              className="font-semibold text-gold underline"
            >
              {h.blocked[1]}
            </Link>
            {h.blocked[2]}
          </p>
        ) : null}

        <section aria-labelledby="missions-title">
          <h2
            id="missions-title"
            className="mb-3 flex items-center gap-2 font-display text-3xl tracking-wide uppercase"
          >
            <Target className="size-6 text-accent-text" aria-hidden /> {h.missions}
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
                        <span className="text-xs text-subtle">{h.missionType[mission.type]}</span>
                      </p>
                      {mission.description ? <p className="mt-1 text-sm text-muted">{mission.description}</p> : null}
                      <p className="num mt-2 text-xs text-gold">
                        {h.reward(formatInteger(mission.points), formatInteger(mission.xp))}
                      </p>
                    </div>
                    {done ? (
                      <p className="text-sm font-semibold text-accent-text">
                        {mission.type === "daily" ? h.claimedToday : h.done}
                      </p>
                    ) : blocked ? null : (
                      <MissionForm missionId={mission.id} type={mission.type} url={mission.url} />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Target} title={h.noMissionsTitle}>
              {h.noMissions}
            </EmptyState>
          )}
        </section>

        <section aria-labelledby="shop-title">
          <h2 id="shop-title" className="mb-3 flex items-center gap-2 font-display text-3xl tracking-wide uppercase">
            <Gift className="size-6 text-accent-text" aria-hidden /> {h.shop}
          </h2>
          {items.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const image = publicAssetUrl(item.image_path);
                const soldOut = item.stock !== null && item.stock <= 0;
                const limitReached = item.per_user_limit !== null && orderCount(item) >= item.per_user_limit;
                const reason = soldOut
                  ? h.soldOut
                  : limitReached
                    ? h.alreadyRedeemed
                    : profile.level < item.min_level
                      ? h.fromLevel(item.min_level)
                      : profile.points < item.cost
                        ? h.missing(formatInteger(item.cost - profile.points))
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
                        {item.stock !== null ? h.available(formatInteger(item.stock)) : h.unlimited}
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
                            pendingLabel={h.redeeming}
                            confirmText={h.redeemConfirm(item.title, formatInteger(item.cost))}
                            confirmLabel={h.redeem}
                          >
                            {h.redeem}
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Gift} title={h.shopSoonTitle}>
              {h.shopSoon}
            </EmptyState>
          )}
        </section>

        {orders.data?.length ? (
          <section aria-labelledby="orders-title">
            <h2 id="orders-title" className="mb-3 font-display text-2xl tracking-wide uppercase">
              {h.myOrders}
            </h2>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
              {orders.data.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <span className="font-semibold">{order.item_title}</span>
                  <span className="num text-xs text-subtle">{h.pointsN(formatInteger(order.cost))}</span>
                  <span
                    className={cn(
                      "ml-auto text-xs font-semibold",
                      order.status === "pending" && "text-gold",
                      order.status === "delivered" && "text-emerald-400",
                      order.status === "cancelled" && "text-live",
                    )}
                  >
                    {h.orderStatus[order.status]}
                  </span>
                  {order.note ? <span className="w-full text-xs text-muted">{order.note}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="history-title">
          <h2 id="history-title" className="mb-3 flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
            <History className="size-5 text-accent-text" aria-hidden /> {h.history}
          </h2>
          {events.data?.length ? (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
              {events.data.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    {h.rewards[event.kind]?.[0] ?? h.pointKinds[event.kind] ?? event.kind}
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
                  <span className="w-28 text-right text-xs text-subtle">{formatDateTime(event.created_at, lang)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">
              {h.noHistory}
            </p>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <section aria-labelledby="earn-title" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="earn-title" className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
            <Sparkles className="size-5 text-gold" aria-hidden /> {h.howToEarn}
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {REWARD_KINDS.map((reward) => (
              <li key={reward.key}>
                <p className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{h.rewards[reward.key]?.[0] ?? reward.label}</span>
                  <span className="num text-xs text-gold">
                    +{formatInteger(settings.rewards[reward.key].points)} ·{" "}
                    {formatInteger(settings.rewards[reward.key].xp)} XP
                  </span>
                </p>
                <p className="text-xs text-subtle">{h.rewards[reward.key]?.[1] ?? reward.description}</p>
              </li>
            ))}
          </ul>
        </section>

        {leaders.length ? (
          <section aria-labelledby="leaders-title" className="rounded-2xl border border-line bg-surface p-5">
            <h2 id="leaders-title" className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
              <Trophy className="size-5 text-gold" aria-hidden /> {h.topXp}
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
                  <span className="num text-xs text-accent-text">{h.levelShort(leader.level)}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function ProfileCard({
  profile,
  progress,
  lang,
}: {
  profile: CurrentProfile;
  progress: ReturnType<typeof levelFromXp>;
  lang: Locale;
}) {
  const h = getI18n(lang).t.hq;
  const name = profile.display_name || profile.twitch_login || "Viewer";
  const badge = levelBadge(progress.level);
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-accent/40 bg-[linear-gradient(135deg,rgb(157_59_255/0.12),transparent_60%)] p-6 sm:flex-row sm:items-center">
      <Avatar url={profile.avatar_url} name={name} size={72} />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="flex flex-wrap items-baseline gap-3">
          <span className="truncate font-display text-3xl tracking-wide uppercase">{name}</span>
          <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-bold text-white">
            {h.level(progress.level)}
          </span>
          {badge ? (
            <span
              title={h.badge(badge)}
              className="flex items-center gap-1 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-sm font-bold text-gold"
            >
              <Award className="size-4" aria-hidden />
              <span className="sr-only">{h.badge(badge)}</span>
              <span aria-hidden>{badge}</span>
            </span>
          ) : null}
        </p>
        <div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-label={h.progress}
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
            {h.xpToNext(formatInteger(progress.xpIntoLevel), formatInteger(progress.xpForNext), progress.level + 1)}
          </p>
        </div>
      </div>
      <dl className="flex gap-3">
        <div className="rounded-xl bg-surface px-4 py-3 text-center">
          <dt className="flex items-center justify-center gap-1 text-xs text-subtle">
            <Coins className="size-3.5" aria-hidden /> {h.points}
          </dt>
          <dd className="num text-2xl font-bold text-gold">{formatInteger(profile.points)}</dd>
        </div>
        <div className="rounded-xl bg-surface px-4 py-3 text-center">
          <dt className="flex items-center justify-center gap-1 text-xs text-subtle">
            <Ticket className="size-3.5" aria-hidden /> {h.tickets}
          </dt>
          <dd className="num text-2xl font-bold text-gold">{formatInteger(profile.tickets)}</dd>
        </div>
      </dl>
    </section>
  );
}
