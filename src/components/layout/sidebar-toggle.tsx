"use client";

import { Menu } from "lucide-react";
import { SIDEBAR_KEY } from "./sidebar";

const buttonClass = "flex size-10 items-center justify-center rounded-lg text-text hover:bg-surface-2";

/** En celular abre el cajón; en compu achica o agranda la barra lateral. */
export function SidebarToggle() {
  const openDrawer = () => {
    document.documentElement.dataset.drawer = "open";
  };
  const toggleCollapsed = () => {
    const root = document.documentElement;
    const collapsed = root.dataset.sidebar !== "collapsed";
    if (collapsed) root.dataset.sidebar = "collapsed";
    else delete root.dataset.sidebar;
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "open");
    } catch {
      // sin storage: solo dura esta visita
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        aria-label="Abrir menú"
        aria-controls="menu-lateral"
        className={`${buttonClass} lg:hidden`}
      >
        <Menu className="size-6" aria-hidden />
      </button>
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label="Achicar o agrandar el menú"
        aria-controls="menu-lateral"
        className={`${buttonClass} hidden lg:flex`}
      >
        <Menu className="size-5" aria-hidden />
      </button>
    </>
  );
}
