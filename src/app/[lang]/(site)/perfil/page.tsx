import type { Locale } from "@/i18n/config";
import { getI18n, pageLocale } from "@/i18n/server";
import { BadgeCheck, CalendarDays, ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentProfile } from "@/lib/auth/session";
import { getActiveCasinos } from "@/lib/casinos";
import { formatDate, maskAccountId } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccountForm } from "./delete-account-form";
import { VerificationForm } from "./verification-form";

export async function generateMetadata({ params }: PageProps<"/[lang]/perfil">): Promise<Metadata> {
  const { t } = getI18n(await pageLocale(params));
  return { title: t.profile.title, robots: { index: false } };
}

export default async function PerfilPage({ params }: PageProps<"/[lang]/perfil">) {
  const lang = await pageLocale(params);
  const { t } = getI18n(lang);
  return (
    <>
      <PageHeader title={t.profile.title} />
      <div className="mx-auto max-w-3xl px-4 pb-16">
        <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-surface" />}>
          <ProfileDetails lang={lang} />
        </Suspense>
      </div>
    </>
  );
}

async function ProfileDetails({ lang }: { lang: Locale }) {
  const { t, href } = getI18n(lang);
  const p = t.profile;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`${href("/entrar")}?next=${href("/perfil")}`);

  const name = profile.display_name || profile.twitch_login || t.userMenu.user;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
        <Avatar url={profile.avatar_url} name={name} size={72} />
        <div className="min-w-0">
          <h2 className="truncate font-display text-3xl tracking-wide uppercase">{name}</h2>
          {profile.twitch_login ? <p className="num text-sm text-subtle">twitch.tv/{profile.twitch_login}</p> : null}
          <span className="mt-2 inline-block rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-accent-text">
            {p.role[profile.role]}
          </span>
        </div>
      </section>

      <dl className="grid gap-3 sm:grid-cols-3">
        <Fact icon={CalendarDays} label={p.memberSince} value={formatDate(profile.created_at, lang)} />
        <Fact
          icon={UserRound}
          label={p.twitchCreated}
          value={profile.twitch_created_at ? formatDate(profile.twitch_created_at, lang) : p.noData}
        />
        <Fact
          icon={ShieldCheck}
          label={p.termsAccepted}
          value={profile.terms_version ? p.version(profile.terms_version) : p.pending}
        />
      </dl>

      {!profile.adult_confirmed_at ? (
        <p className="rounded-xl border border-gold/40 bg-gold/5 px-4 py-3 text-sm">
          {p.ageMissing[0]}
          <Link href={`${href("/bienvenida")}?next=${href("/perfil")}`} className="font-semibold text-gold underline">
            {p.ageMissing[1]}
          </Link>
          {p.ageMissing[2]}
        </p>
      ) : null}

      <CasinoAccounts userId={profile.id} lang={lang} />

      <DeleteAccountForm />
    </div>
  );
}

const ACCOUNT_STATUS_CLASS = { pending: "text-gold", approved: "text-emerald-400", rejected: "text-live" } as const;

/** Cuentas de casino del viewer y el formulario para verificar una nueva (Wager Race, sorteos con casino). */
async function CasinoAccounts({ userId, lang }: { userId: string; lang: Locale }) {
  const p = getI18n(lang).t.profile;
  const supabase = await createClient();
  const [{ data: accounts }, casinos] = await Promise.all([
    supabase
      .from("casino_accounts")
      .select("id, casino_id, account_id, status, reject_reason, casino:casinos(name)")
      .eq("user_id", userId)
      .order("created_at"),
    getActiveCasinos(),
  ]);
  // Una rechazada se puede volver a mandar.
  const done = new Set((accounts ?? []).filter((a) => a.status !== "rejected").map((a) => a.casino_id));
  const available = casinos.filter((c) => !done.has(c.id));

  return (
    <section
      id="cuentas"
      aria-labelledby="accounts-title"
      className="scroll-mt-24 rounded-2xl border border-line bg-surface p-5"
    >
      <h2 id="accounts-title" className="flex items-center gap-2 font-semibold">
        <BadgeCheck className="size-4 text-accent-text" aria-hidden /> {p.accounts}
      </h2>
      {accounts?.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {accounts.map((account) => (
            <li key={account.id} className="flex flex-wrap items-center gap-x-3 rounded-lg bg-surface-2 px-3 py-2">
              <span className="font-semibold">{account.casino?.name ?? p.casino}</span>
              <span className="num text-xs text-subtle">{maskAccountId(account.account_id)}</span>
              <span className={`ml-auto text-xs ${ACCOUNT_STATUS_CLASS[account.status]}`}>
                {p.accountStatus[account.status]}
                {account.status === "rejected" && account.reject_reason ? `: ${account.reject_reason}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{p.noAccounts}</p>
      )}
      {available.length ? (
        <div className="mt-5 border-t border-line pt-5">
          <h3 className="font-semibold">{p.verifyTitle}</h3>
          <p className="mt-1 mb-3 text-sm text-muted">{p.verifyText}</p>
          <VerificationForm casinos={available.map(({ id, name }) => ({ id, name }))} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">{p.allDone}</p>
      )}
    </section>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <dt className="flex items-center gap-2 text-xs text-subtle">
        <Icon className="size-4" aria-hidden /> {label}
      </dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
