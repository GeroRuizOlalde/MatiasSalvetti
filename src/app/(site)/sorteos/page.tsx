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

export const metadata: Metadata = {
  title: "Sorteos",
  description: "Sorteos activos y terminados para la comunidad.",
};

const PHASE = {
  open: { label: "Abierto", tone: "live" },
  upcoming: { label: "Próximo", tone: "next" },
  closed: { label: "Cerrado", tone: "done" },
} as const;

export default async function SorteosPage() {
  const giveaways = await getPublicGiveaways();

  return (
    <>
      <PageHeader kicker="para la comunidad" title="Sorteos">
        Entrá con Twitch y anotate. Algunos son gratis y en otros cada ticket es una chance más: los tickets se
        consiguen en la tienda del{" "}
        <Link href="/cuartel" className="font-semibold text-accent-text hover:underline">
          Cuartel
        </Link>
        .
      </PageHeader>
      <div className="mx-auto max-w-7xl px-4 pb-16">
        {giveaways.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {giveaways.map((giveaway) => (
              <li key={giveaway.id} className="reveal">
                <GiveawayCard giveaway={giveaway} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Gift} title="No hay sorteos por ahora">
            Atento al stream: los sorteos se anuncian en vivo.
          </EmptyState>
        )}
      </div>
    </>
  );
}

function GiveawayCard({ giveaway }: { giveaway: PublicGiveaway }) {
  const image = publicAssetUrl(giveaway.image_path);
  const phase = PHASE[giveaway.phase];

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      {image ? (
        <Image src={image} alt="" width={800} height={400} className="aspect-[2/1] w-full object-cover" />
      ) : null}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill label={phase.label} tone={phase.tone} />
          <span className="flex items-center gap-1 text-xs text-subtle">
            <CalendarDays className="size-3.5" aria-hidden />
            {giveaway.phase === "upcoming"
              ? `Abre ${formatDateTime(giveaway.starts_at)}`
              : `Cierra ${formatDateTime(giveaway.ends_at)}`}
          </span>
        </div>
        <div>
          <h2 className="font-display text-3xl tracking-wide uppercase">{giveaway.title}</h2>
          <p className="mt-1 flex items-center gap-2 font-semibold text-gold">
            <Gift className="size-4" aria-hidden /> {giveaway.prize}
            {giveaway.winners_count > 1 ? (
              <span className="text-xs text-muted">· {giveaway.winners_count} ganadores</span>
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
                <Ticket className="size-3.5 text-gold" aria-hidden /> Con tickets (hasta{" "}
                {formatInteger(giveaway.max_tickets_per_user)})
              </>
            ) : (
              <>
                <Star className="size-3.5 text-gold" aria-hidden /> Gratis
              </>
            )}
          </li>
          {giveaway.min_level > 1 ? (
            <li className="rounded-full bg-surface-2 px-3 py-1">Nivel {giveaway.min_level}+</li>
          ) : null}
          {giveaway.casino ? (
            <li className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1">
              <BadgeCheck className="size-3.5 text-accent-text" aria-hidden /> Cuenta verificada en{" "}
              {giveaway.casino.name}
            </li>
          ) : null}
          <li className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1">
            <Users className="size-3.5" aria-hidden /> {formatInteger(giveaway.participants)} anotados
            {giveaway.entry_mode === "tickets" ? ` · ${formatInteger(giveaway.entries)} tickets` : ""}
          </li>
        </ul>

        {giveaway.phase === "open" ? <Countdown target={giveaway.ends_at} label="Cierra en" /> : null}

        {giveaway.winners.length ? (
          <div className="rounded-xl border border-gold/40 bg-gold/5 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Trophy className="size-4 text-gold" aria-hidden />{" "}
              {giveaway.winners.length > 1 ? "Ganadores" : "Ganador"}
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
          <p className="text-sm text-subtle">El sorteo se hace en vivo. Pronto vas a ver acá a los ganadores.</p>
        ) : null}

        {giveaway.phase === "open" ? (
          <div className="mt-auto border-t border-line pt-4">
            <Suspense fallback={<div className="h-10 animate-pulse rounded-lg bg-surface-2" />}>
              <EntryBox giveaway={giveaway} />
            </Suspense>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Lee la sesión: va dentro de un <Suspense>. */
async function EntryBox({ giveaway }: { giveaway: PublicGiveaway }) {
  const profile = await getCurrentProfile();
  if (!profile) return <LoginButton next="/sorteos" label="Entrá con Twitch para participar" />;

  const terms = await getLegalDocument("terms");
  if (needsOnboarding(profile, terms?.version ?? null)) {
    return (
      <p className="text-sm text-muted">
        Para participar tenés que{" "}
        <Link href="/bienvenida?next=/sorteos" className="font-semibold text-accent-text underline">
          confirmar tu edad y aceptar las bases
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
    return <p className="text-sm font-semibold text-accent-text">¡Ya estás participando! ✓</p>;
  }
  return (
    <div className="space-y-2">
      {entries > 0 ? (
        <p className="text-sm">
          Tenés <strong className="num text-gold">{formatInteger(entries)}</strong> tickets puestos · te quedan{" "}
          <span className="num">{formatInteger(profile.tickets)}</span> en total.
        </p>
      ) : giveaway.entry_mode === "tickets" ? (
        <p className="text-sm text-muted">
          Tenés <span className="num font-semibold text-gold">{formatInteger(profile.tickets)}</span> tickets.
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
