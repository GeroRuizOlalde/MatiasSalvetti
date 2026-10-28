import { ExternalLink } from "lucide-react";
import Image from "next/image";
import { buttonClasses } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import type { PublicCasino } from "@/lib/casinos";
import { publicAssetUrl } from "@/lib/storage";

export function CasinoCard({ casino }: { casino: PublicCasino }) {
  const logo = publicAssetUrl(casino.logo_path);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5">
      <div className="flex h-16 items-center">
        {logo ? (
          <Image src={logo} alt={`Logo de ${casino.name}`} width={160} height={64} className="h-12 w-auto object-contain" />
        ) : (
          <span className="font-display text-3xl tracking-wide uppercase">{casino.name}</span>
        )}
      </div>
      {logo ? <h3 className="mt-2 font-semibold">{casino.name}</h3> : null}

      <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-dashed border-line-strong bg-surface-2 py-1 pr-1 pl-3">
        <div>
          <p className="text-[11px] tracking-wide text-subtle uppercase">Código</p>
          <p className="num font-bold text-gold">{casino.code ?? "[CÓDIGO]"}</p>
        </div>
        {casino.code ? <CopyButton value={casino.code} label={`Copiar el código de ${casino.name}`} /> : null}
      </div>

      <a
        href={casino.referral_url}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className={buttonClasses({ className: "mt-5 w-full" })}
      >
        Registrarme <ExternalLink className="size-4" aria-hidden />
        <span className="sr-only">en {casino.name} (link de referido, se abre en otra pestaña)</span>
      </a>
    </article>
  );
}
