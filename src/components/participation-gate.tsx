import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { Megaphone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LoginButton } from "@/components/layout/login-button";
import { getCurrentProfile, needsOnboarding, type CurrentProfile } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { getLegalDocument } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

export const participationBox = "rounded-2xl border border-accent/40 bg-accent/5 p-5";

export function ParticipationTitle({ children }: { children: ReactNode }) {
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
  lang,
}: {
  /** Ruta a la que vuelve después del login o la bienvenida. */
  next: string;
  loginHint: string;
  title?: ReactNode;
  lang: Locale;
  children: (profile: CurrentProfile) => ReactNode | Promise<ReactNode>;
}) {
  const { t, href } = getI18n(lang);
  const box = (body: ReactNode) => (
    <section className={participationBox}>
      <ParticipationTitle>{title ?? t.participation.title}</ParticipationTitle>
      {body}
    </section>
  );

  const profile = await getCurrentProfile();
  if (!profile) {
    return box(
      <>
        <p className="mt-2 mb-4 text-sm text-muted">{loginHint}</p>
        <LoginButton next={href(next)} lang={lang} />
      </>,
    );
  }

  const terms = await getLegalDocument("terms");
  if (needsOnboarding(profile, terms?.version ?? null)) {
    return box(
      <p className="mt-2 text-sm text-muted">
        {t.participation.beforeYouJoin}{" "}
        <Link
          href={href(`/bienvenida?next=${encodeURIComponent(href(next))}`)}
          className="font-semibold text-accent-text underline"
        >
          {t.participation.confirmAge}
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
        {profile.banned_at ? t.participation.banned : t.participation.tooNew}
      </p>,
    );
  }

  return children(profile);
}
