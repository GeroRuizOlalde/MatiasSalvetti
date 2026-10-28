import { Megaphone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LoginButton } from "@/components/layout/login-button";
import { getCurrentProfile, needsOnboarding, type CurrentProfile } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { getLegalDocument } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

export const participationBox = "rounded-2xl border border-accent/40 bg-accent/5 p-5";

export function ParticipationTitle({ children = "Participá" }: { children?: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
      <Megaphone className="size-5 text-accent-text" aria-hidden /> {children}
    </h2>
  );
}

/**
 * Lee la sesión: va dentro de un <Suspense>. Si el usuario no entró, no
 * aceptó las bases o no cumple los requisitos, muestra qué le falta; si no,
 * renderiza `children` con su perfil.
 */
export async function ParticipationGate({
  next,
  loginHint,
  title,
  children,
}: {
  /** Ruta a la que vuelve después del login o la bienvenida. */
  next: string;
  loginHint: string;
  title?: ReactNode;
  children: (profile: CurrentProfile) => ReactNode | Promise<ReactNode>;
}) {
  const box = (body: ReactNode) => (
    <section className={participationBox}>
      <ParticipationTitle>{title}</ParticipationTitle>
      {body}
    </section>
  );

  const profile = await getCurrentProfile();
  if (!profile) {
    return box(
      <>
        <p className="mt-2 mb-4 text-sm text-muted">{loginHint}</p>
        <LoginButton next={next} />
      </>,
    );
  }

  const terms = await getLegalDocument("terms");
  if (needsOnboarding(profile, terms?.version ?? null)) {
    return box(
      <p className="mt-2 text-sm text-muted">
        Antes de participar tenés que{" "}
        <Link
          href={`/bienvenida?next=${encodeURIComponent(next)}`}
          className="font-semibold text-accent-text underline"
        >
          confirmar tu edad y aceptar las bases
        </Link>
        .
      </p>,
    );
  }

  const supabase = await createClient();
  const { data: canParticipate } = await supabase.rpc("can_participate");
  if (!canParticipate) {
    return box(
      <p className={cn("mt-2 text-sm text-muted")}>
        {profile.banned_at
          ? "Tu cuenta no puede participar."
          : "Tu cuenta de Twitch todavía no cumple la antigüedad mínima para participar."}
      </p>,
    );
  }

  return children(profile);
}
