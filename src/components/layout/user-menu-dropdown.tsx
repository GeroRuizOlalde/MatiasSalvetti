"use client";

import { BadgeCheck, Castle, ChevronDown, Coins, LayoutDashboard, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/ui/avatar";
import { useI18n } from "@/i18n/client";

type Props = {
  displayName: string;
  avatarUrl: string | null;
  canUsePanel: boolean;
  level: number;
  points: number;
};

const itemClass =
  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-text";

export function UserMenuDropdown({ displayName, avatarUrl, canUsePanel, level, points }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { t, href } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const fullPoints = new Intl.NumberFormat("es-AR").format(points);
  // En el celular el header es angosto: 12.500 se ve como 12,5 mil.
  const compactPoints = new Intl.NumberFormat("es-AR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(points);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t.userMenu.menuOf(displayName)}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface p-1 pr-3 hover:border-line-strong"
      >
        <Avatar url={avatarUrl} name={displayName} />
        <span
          className="num flex items-center gap-1 text-sm font-bold text-gold"
          title={t.userMenu.pointsOf(fullPoints)}
        >
          <Coins className="size-4" aria-hidden />
          <span className="sm:hidden" aria-hidden>
            {compactPoints}
          </span>
          <span className="hidden sm:inline" aria-hidden>
            {fullPoints}
          </span>
          <span className="sr-only">{t.userMenu.pointsOf(fullPoints)}</span>
        </span>
        <span className="hidden max-w-32 truncate text-sm font-semibold sm:inline">{displayName}</span>
        <ChevronDown className="hidden size-4 text-subtle sm:block" aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-2 shadow-2xl shadow-black/50"
        >
          <p className="num mb-1 border-b border-line px-3 pt-1 pb-2 text-xs text-subtle">
            {t.userMenu.level} <span className="font-semibold text-accent-text">{level}</span> ·{" "}
            <span className="font-semibold text-gold">{new Intl.NumberFormat("es-AR").format(points)}</span>{" "}
            {t.userMenu.points}
          </p>
          <Link href={href("/perfil")} className={itemClass} onClick={close}>
            <User className="size-4" aria-hidden /> {t.userMenu.profile}
          </Link>
          <Link href={href("/perfil#cuentas")} className={itemClass} onClick={close}>
            <BadgeCheck className="size-4" aria-hidden /> {t.userMenu.verify}
          </Link>
          <Link href={href("/cuartel")} className={itemClass} onClick={close}>
            <Castle className="size-4" aria-hidden /> {t.userMenu.hq}
          </Link>
          {canUsePanel ? (
            <Link href="/panel" className={itemClass} onClick={close}>
              <LayoutDashboard className="size-4" aria-hidden /> {t.userMenu.panel}
            </Link>
          ) : null}
          <form action={signOut} className="mt-1 border-t border-line pt-1">
            <button type="submit" className={itemClass}>
              <LogOut className="size-4" aria-hidden /> {t.userMenu.signOut}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
