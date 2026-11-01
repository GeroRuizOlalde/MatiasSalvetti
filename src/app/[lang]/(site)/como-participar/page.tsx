import { BadgeCheck, Gamepad2, Landmark, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CasinoCard } from "@/components/casinos/casino-card";
import { BrandIcon } from "@/components/ui/brand-icon";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveCasinos } from "@/lib/casinos";
import { getI18n, pageLocale } from "@/i18n/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/como-participar">): Promise<Metadata> {
  const { t } = getI18n(await pageLocale(params));
  return { title: t.howTo.title, description: t.howTo.metaDescription };
}

const linkClass = "font-semibold text-accent-text underline-offset-2 hover:underline";

export default async function ComoParticiparPage({ params }: PageProps<"/[lang]/como-participar">) {
  const lang = await pageLocale(params);
  const { t, href } = getI18n(lang);
  const h = t.howTo;
  const casinos = await getActiveCasinos();

  const steps: { icon: LucideIcon | "twitch"; title: string; body: ReactNode }[] = [
    {
      icon: "twitch",
      title: h.step1Title,
      body: (
        <>
          {h.step1[0]}
          <strong>{h.step1[1]}</strong>
          {h.step1[2]}
        </>
      ),
    },
    {
      icon: ShieldCheck,
      title: h.step2Title,
      body: (
        <>
          {h.step2[0]}
          <Link href={href("/bases-y-condiciones")} className={linkClass}>
            {h.step2[1]}
          </Link>
          {h.step2[2]}
        </>
      ),
    },
    { icon: Landmark, title: h.step3Title, body: h.step3 },
    {
      icon: BadgeCheck,
      title: h.step4Title,
      body: (
        <>
          {h.step4[0]}
          <strong>{h.step4[1]}</strong>
          {h.step4[2]}
          <Link href={href("/perfil#cuentas")} className={linkClass}>
            {h.step4[3]}
          </Link>
          {h.step4[4]}
        </>
      ),
    },
    {
      icon: Gamepad2,
      title: h.step5Title,
      body: (
        <>
          {h.step5[0]}
          <Link href={href("/cuartel")} className={linkClass}>
            {h.step5[1]}
          </Link>
          {h.step5[2]}
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader kicker={h.kicker} title={h.title}>
        {h.intro}
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
            <UserRound className="size-6 text-gold" aria-hidden /> {h.requirements}
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-muted">
            <li>{h.req1}</li>
            <li>{h.req2}</li>
            <li>{h.req3}</li>
          </ul>
        </section>

        {casinos.length > 0 ? (
          <section aria-labelledby="casinos-title" className="mt-12">
            <h2 id="casinos-title" className="mb-4 font-display text-3xl tracking-wide uppercase">
              {h.casinos}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {casinos.map((casino) => (
                <li key={casino.id}>
                  <CasinoCard casino={casino} lang={lang} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
