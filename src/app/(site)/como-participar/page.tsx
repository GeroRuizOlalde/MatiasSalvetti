import { BadgeCheck, Gamepad2, Landmark, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CasinoCard } from "@/components/casinos/casino-card";
import { BrandIcon } from "@/components/ui/brand-icon";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveCasinos } from "@/lib/casinos";

export const metadata: Metadata = {
  title: "Cómo participar",
  description: "Los pasos para sumarte a calls, apuestas de balance, sorteos y la Wager Race.",
};

const linkClass = "font-semibold text-accent-text underline-offset-2 hover:underline";

export default async function ComoParticiparPage() {
  const casinos = await getActiveCasinos();

  const steps: { icon: LucideIcon | "twitch"; title: string; body: ReactNode }[] = [
    {
      icon: "twitch",
      title: "Entrá con tu cuenta de Twitch",
      body: (
        <>
          Tocá <strong>Entrar con Twitch</strong> arriba a la derecha. No hace falta crear otra cuenta: usamos tu
          usuario de Twitch para todo.
        </>
      ),
    },
    {
      icon: ShieldCheck,
      title: "Confirmá tu edad y aceptá las bases",
      body: (
        <>
          La primera vez te pedimos que confirmes que sos mayor de 18 y que aceptes las{" "}
          <Link href="/bases-y-condiciones" className={linkClass}>
            bases y condiciones
          </Link>
          .
        </>
      ),
    },
    {
      icon: Landmark,
      title: "Creá tu cuenta en un casino con el link de Matías",
      body: (
        <>
          Para la Wager Race y algunos sorteos tenés que registrarte desde los links de abajo y usar el código. Si ya
          tenías cuenta en ese casino de antes, puede que no cuente.
        </>
      ),
    },
    {
      icon: BadgeCheck,
      title: "Verificá tu cuenta de casino",
      body: (
        <>
          Cargá el ID de tu cuenta y una captura de pantalla desde la pestaña <strong>Verificación</strong> de la{" "}
          <Link href="/wager-race" className={linkClass}>
            Wager Race
          </Link>
          . Un admin la revisa y vas a ver el estado en tu{" "}
          <Link href="/perfil" className={linkClass}>
            perfil
          </Link>
          .
        </>
      ),
    },
    {
      icon: Gamepad2,
      title: "Participá y sumá puntos",
      body: (
        <>
          Pedí un slot en los bonus hunts, adiviná el balance final, pedí la próxima compra en los buys, bancá a tu slot
          en las battles y entrá a los sorteos. Todo suma XP y puntos en el{" "}
          <Link href="/cuartel" className={linkClass}>
            Cuartel
          </Link>
          .
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader kicker="arrancá acá" title="Cómo participar">
        Cinco pasos y ya estás adentro.
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 pb-16">
        <ol className="grid gap-4 lg:grid-cols-5">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className="num flex size-9 items-center justify-center rounded-full bg-accent font-bold text-white">
                  {i + 1}
                </span>
                {step.icon === "twitch" ? (
                  <BrandIcon name="twitch" className="size-6 text-accent-text" />
                ) : (
                  <step.icon className="size-6 text-accent-text" aria-hidden />
                )}
              </div>
              <h2 className="mt-4 font-display text-xl tracking-wide uppercase">{step.title}</h2>
              <p className="mt-2 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <section aria-labelledby="req-title" className="mt-12 rounded-2xl border border-gold/30 bg-gold/5 p-6">
          <h2 id="req-title" className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
            <UserRound className="size-6 text-gold" aria-hidden /> Requisitos
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-muted">
            <li>Ser mayor de 18 años.</li>
            <li>Una sola cuenta por persona. Las multicuentas quedan afuera de todo.</li>
            <li>
              Algunas dinámicas piden una antigüedad mínima de tu cuenta de Twitch o una cuenta de casino verificada.
            </li>
          </ul>
        </section>

        {casinos.length > 0 ? (
          <section aria-labelledby="casinos-title" className="mt-12">
            <h2 id="casinos-title" className="mb-4 font-display text-3xl tracking-wide uppercase">
              Casinos
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {casinos.map((casino) => (
                <li key={casino.id}>
                  <CasinoCard casino={casino} />
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-subtle">
              Son links de referido: Matías recibe una comisión si te registrás desde acá.
            </p>
          </section>
        ) : null}
      </div>
    </>
  );
}
