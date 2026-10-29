import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginButton } from "@/components/layout/login-button";
import { buttonClasses } from "@/components/ui/button";
import { getCurrentProfile, isPanelRole, safeNext } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Entrar al panel",
  robots: { index: false, follow: false },
};

export default function PanelLoginPage({ searchParams }: PageProps<"/panel/login">) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 text-center">
        <h1 className="font-display text-4xl tracking-wide text-accent-light uppercase">Panel</h1>
        <p className="mt-2 text-sm text-muted">Entrá con la cuenta de Twitch que tiene permisos de mod o admin.</p>
        <Suspense fallback={<div className="mt-6 h-11 animate-pulse rounded-lg bg-surface-2" />}>
          <PanelLoginBox searchParams={searchParams} />
        </Suspense>
        <Link href="/" className="mt-6 inline-block text-xs text-subtle hover:text-text">
          Volver a la web
        </Link>
      </div>
    </div>
  );
}

async function PanelLoginBox({ searchParams }: { searchParams: PageProps<"/panel/login">["searchParams"] }) {
  if (!isSupabaseConfigured()) {
    return (
      <p role="alert" className="mt-6 rounded-lg border border-gold/40 bg-gold/5 px-4 py-3 text-sm">
        Supabase todavía no está configurado. Completá las variables de entorno (ver README).
      </p>
    );
  }

  const [params, profile] = await Promise.all([searchParams, getCurrentProfile()]);
  const next = safeNext(params.next, "/panel");
  const canEnter = profile && isPanelRole(profile.role) && !profile.banned_at;

  if (canEnter) {
    return (
      <Link href={next} className={buttonClasses({ className: "mt-6 w-full" })}>
        Ir al panel
      </Link>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {params.error === "sin-permiso" || profile ? (
        <p role="alert" className="rounded-lg border border-live/40 bg-live/10 px-4 py-3 text-sm">
          {profile
            ? `Tu cuenta (${profile.twitch_login ?? profile.display_name}) no tiene acceso al panel. Pedile a Chupetti que te dé permisos.`
            : "Esa cuenta no tiene acceso al panel."}
        </p>
      ) : null}
      {!profile ? <LoginButton next={next} size="md" /> : null}
    </div>
  );
}
