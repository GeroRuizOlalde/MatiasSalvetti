"use client";

import { ChevronDown, LayoutDashboard, LogOut, Swords, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/ui/avatar";

type Props = { displayName: string; avatarUrl: string | null; canUsePanel: boolean };

const itemClass =
  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-text";

export function UserMenuDropdown({ displayName, avatarUrl, canUsePanel }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Menú de ${displayName}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 hover:border-line-strong"
      >
        <Avatar url={avatarUrl} name={displayName} />
        <span className="max-w-32 truncate text-sm font-semibold">{displayName}</span>
        <ChevronDown className="size-4 text-subtle" aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-2 shadow-2xl shadow-black/50"
        >
          <Link href="/perfil" className={itemClass} onClick={close}>
            <User className="size-4" aria-hidden /> Mi perfil
          </Link>
          <Link href="/cuartel" className={itemClass} onClick={close}>
            <Swords className="size-4" aria-hidden /> Cuartel
          </Link>
          {canUsePanel ? (
            <Link href="/panel" className={itemClass} onClick={close}>
              <LayoutDashboard className="size-4" aria-hidden /> Panel
            </Link>
          ) : null}
          <form action={signOut} className="mt-1 border-t border-line pt-1">
            <button type="submit" className={itemClass}>
              <LogOut className="size-4" aria-hidden /> Salir
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
