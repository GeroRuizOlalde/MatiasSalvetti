import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginButton } from "@/components/layout/login-button";
import { getCurrentProfile, safeNext } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false },
};

const ERRORS: Record<string, string> = {
  oauth: "No pudimos completar el login con Twitch. Probá de nuevo.",
  config: "El login todavía no está configurado en este entorno.",
};

export default function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <p className="font-marker text-xl text-accent-text">entrá al casino</p>
      <h1 className="mt-1 font-display text-5xl tracking-wide uppercase">Entrar</h1>
      <p className="mt-4 text-muted">
        Usamos tu cuenta de Twitch para que participes en calls, apuestas, sorteos y el Cuartel.
      </p>
      <Suspense fallback={<div className="mt-8 h-12 w-full animate-pulse rounded-lg bg-surface-2" />}>
        <LoginBox searchParams={searchParams} />
      </Suspense>
      <p className="mt-6 text-xs text-subtle">Solo para mayores de 18 años.</p>
    </div>
  );
}

async function LoginBox({ searchParams }: { searchParams: PageProps<"/entrar">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getCurrentProfile()) redirect(next);

  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  return (
    <div className="mt-8 w-full">
      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-live/40 bg-live/10 px-4 py-3 text-sm text-text">
          {error}
        </p>
      ) : null}
      <LoginButton next={next} size="lg" />
    </div>
  );
}
