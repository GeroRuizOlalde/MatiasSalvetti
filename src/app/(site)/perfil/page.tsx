import { CalendarDays, ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentProfile } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = {
  title: "Mi perfil",
  robots: { index: false },
};

const ROLE_LABEL = { viewer: "Viewer", mod: "Moderador", admin: "Admin" } as const;

export default function PerfilPage() {
  return (
    <>
      <PageHeader title="Mi perfil" />
      <div className="mx-auto max-w-3xl px-4 pb-16">
        <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-surface" />}>
          <ProfileDetails />
        </Suspense>
      </div>
    </>
  );
}

async function ProfileDetails() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar?next=/perfil");

  const name = profile.display_name || profile.twitch_login || "Usuario";

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
        <Avatar url={profile.avatar_url} name={name} size={72} />
        <div className="min-w-0">
          <h2 className="truncate font-display text-3xl tracking-wide uppercase">{name}</h2>
          {profile.twitch_login ? (
            <p className="num text-sm text-subtle">twitch.tv/{profile.twitch_login}</p>
          ) : null}
          <span className="mt-2 inline-block rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-accent-text">
            {ROLE_LABEL[profile.role]}
          </span>
        </div>
      </section>

      <dl className="grid gap-3 sm:grid-cols-3">
        <Fact icon={CalendarDays} label="Miembro desde" value={formatDate(profile.created_at)} />
        <Fact
          icon={UserRound}
          label="Cuenta de Twitch creada"
          value={profile.twitch_created_at ? formatDate(profile.twitch_created_at) : "Sin dato"}
        />
        <Fact
          icon={ShieldCheck}
          label="Bases aceptadas"
          value={profile.terms_version ? `Versión ${profile.terms_version}` : "Pendiente"}
        />
      </dl>

      {!profile.adult_confirmed_at ? (
        <p className="rounded-xl border border-gold/40 bg-gold/5 px-4 py-3 text-sm">
          Todavía no confirmaste tu edad.{" "}
          <Link href="/bienvenida?next=/perfil" className="font-semibold text-gold underline">
            Completalo acá
          </Link>{" "}
          para poder participar.
        </p>
      ) : null}

      <p className="text-sm text-subtle">
        Acá vas a ver tus verificaciones de casino, calls, apuestas y participaciones a medida que se habiliten.
      </p>

      <DeleteAccountForm />
    </div>
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
