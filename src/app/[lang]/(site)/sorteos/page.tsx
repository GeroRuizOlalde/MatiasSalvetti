import type { Locale } from "@/i18n/config";
import { getI18n, pageLocale } from "@/i18n/server";
import { BadgeCheck, CalendarDays, Gift, Star, Ticket, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LoginButton } from "@/components/layout/login-button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Countdown } from "@/components/wager/countdown";
import { getCurrentProfile, needsOnboarding } from "@/lib/auth/session";
import { formatDateTime, formatInteger } from "@/lib/format";
import { getPublicGiveaways, type PublicGiveaway } from "@/lib/giveaways";
import { getLegalDocument } from "@/lib/legal";
import { publicAssetUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { EntryForm } from "./entry-form";

export async function generateMetadata({ params }: PageProps<"/[lang]/sorteos">): Promise<Metadata> {
  const { t } = getI18n(await pageLocale(params));
  return { title: t.giveaways.title, description: t.giveaways.metaDescription };
}

const PHASE_TONE = { open: "live", upcoming: "next", closed: "done" } as const;

export default async function SorteosPage({ params }: PageProps<"/[lang]/sorteos">) {
  const lang = await pageLocale(params);
  const { t, href } = getI18n(lang);
  const g = t.giveaways;
  const giveaways = await getPublicGiveaways();

  return (
    <>
      <PageHeader kicker={g.kicker} title={g.title}>
        {g.intro[0]}
        <Link href={href("/cuartel")} className="font-semibold text-accent-text hover:underline">
          {g.intro[1]}
        </Link>
        {g.intro[2]}
      </PageHeader>
      <div className="mx-auto max-w-7xl px-4 pb-16">
        {giveaways.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {giveaways.map((giveaway) => (
              <li key={giveaway.id} className="reveal">
                <GiveawayCard giveaway={giveaway} lang={lang} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Gift} title={g.emptyTitle}>
            {g.empty}
          </EmptyState>
        )}
      </div>
    </>
  );
}

function GiveawayCard({ giveaway, lang }: { giveaway: PublicGiveaway; lang: Locale }) {
  const image = publicAssetUrl(giveaway.image_path);
  const g = getI18n(lang).t.giveaways;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      {image ? (
        <Image src={image} alt="" width={800} height={400} className="aspect-[2/1] w-full object-cover" />
      ) : null}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill label={g.phase[giveaway.phase]} tone={PHASE_TONE[giveaway.phase]} />
          <span className="flex items-center gap-1 text-xs text-subtle">
            <CalendarDays className="size-3.5" aria-hidden />
            {giveaway.phase === "upcoming"
              ? g.opens(formatDateTime(giveaway.starts_at, lang))
              : g.closes(formatDateTime(giveaway.ends_at, lang))}
          </span>
        </div>
        <div>
          <h2 className="font-display text-3xl tracking-wide uppercase">{giveaway.title}</h2>
          <p className="mt-1 flex items-center gap-2 font-semibold text-gold">
            <Gift className="size-4" aria-hidden /> {giveaway.prize}
            {giveaway.winners_count > 1 ? (
              <span className="text-xs text-muted">· {g.winnersCount(giveaway.winners_count)}</span>
            ) : null}
          </p>
          {giveaway.description ? (
            <p className="mt-2 text-sm whitespace-pre-line text-muted">{giveaway.description}</p>
          ) : null}
        </div>

        <ul className="flex flex-wrap gap-2 text-xs">
          <li className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1">
            {giveaway.entry_mode === "tickets" ? (
              <>
                <Ticket className="size-3.5 text-gold" aria-hidden />{" "}
                {g.withTickets(formatInteger(giveaway.max_tickets_per_user))}
              </>
            ) : (
              <>
                <Star className="size-3.5 text-gold" aria-hidden /> {g.free}
              </>
            )}
          </li>
          {giveaway.min_level > 1 ? (
            <li className="rounded-full bg-surface-2 px-3 py-1">{g.level(giveaway.min_level)}</li>
          ) : null}
          {giveaway.casino ? (
            <li className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1">
              <BadgeCheck className="size-3.5 text-accent-text" aria-hidden /> {g.verifiedAt(giveaway.casino.name)}
            </li>
          ) : null}
          <li className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1">
            <Users className="size-3.5" aria-hidden /> {g.entrants(formatInteger(giveaway.participants))}
            {giveaway.entry_mode === "tickets" ? ` · ${g.ticketsCount(formatInteger(giveaway.entries))}` : ""}
          </li>
        </ul>

        {giveaway.phase === "open" ? <Countdown target={giveaway.ends_at} label={g.closesIn} /> : null}

        {giveaway.winners.length ? (
          <div className="rounded-xl border border-gold/40 bg-gold/5 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Trophy className="size-4 text-gold" aria-hidden />{" "}
              {giveaway.winners.length > 1 ? g.winners : g.winner}
            </p>
            <ul className="flex flex-wrap gap-2">
              {giveaway.winners.map((winner) => (
                <li
                  key={winner.id}
                  className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pr-3 pl-1 text-sm"
                >
                  <Avatar url={winner.avatarUrl} name={winner.name} size={22} />
                  {winner.name}
                </li>
              ))}
            </ul>
          </div>
        ) : giveaway.phase === "closed" ? (
          <p className="text-sm text-subtle">{g.drawSoon}</p>
        ) : null}

        {giveaway.phase === "open" ? (
          <div className="mt-auto border-t border-line pt-4">
            <Suspense fallback={<div className="h-10 animate-pulse rounded-lg bg-surface-2" />}>
              <EntryBox giveaway={giveaway} lang={lang} />
            </Suspense>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Lee la sesión: va dentro de un <Suspense>. */
async function EntryBox({ giveaway, lang }: { giveaway: PublicGiveaway; lang: Locale }) {
  const { t, href } = getI18n(lang);
  const g = t.giveaways;
  const profile = await getCurrentProfile();
  if (!profile) return <LoginButton next={href("/sorteos")} label={g.loginToJoin} lang={lang} />;

  const terms = await getLegalDocument("terms");
  if (needsOnboarding(profile, terms?.version ?? null)) {
    return (
      <p className="text-sm text-muted">
        {g.beforeJoin}{" "}
        <Link
          href={`${href("/bienvenida")}?next=${href("/sorteos")}`}
          className="font-semibold text-accent-text underline"
        >
          {g.confirmAge}
        </Link>
        .
      </p>
    );
  }

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("giveaway_entries")
    .select("entries")
    .eq("giveaway_id", giveaway.id)
    .eq("user_id", profile.id)
    .maybeSingle();
  const entries = entry?.entries ?? 0;

  if (giveaway.entry_mode === "free" && entries > 0) {
    return <p className="text-sm font-semibold text-accent-text">{g.alreadyIn}</p>;
  }
  return (
    <div className="space-y-2">
      {entries > 0 ? (
        <p className="text-sm">
          {g.youHave} <strong className="num text-gold">{formatInteger(entries)}</strong> {g.ticketsPlaced}{" "}
          <span className="num">{formatInteger(profile.tickets)}</span> {g.inTotal}
        </p>
      ) : giveaway.entry_mode === "tickets" ? (
        <p className="text-sm text-muted">
          {g.youHave} <span className="num font-semibold text-gold">{formatInteger(profile.tickets)}</span> {g.tickets}
        </p>
      ) : null}
      <EntryForm
        giveawayId={giveaway.id}
        mode={giveaway.entry_mode}
        remaining={giveaway.max_tickets_per_user - entries}
        tickets={profile.tickets}
      />
    </div>
  );
}
