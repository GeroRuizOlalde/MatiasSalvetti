import { Menu } from "lucide-react";

/** Mismo botón que MobileMenu, inactivo, mientras se resuelve la URL. */
export function MobileMenuFallback() {
  return (
    <div className="lg:hidden">
      <span aria-hidden className="flex size-11 items-center justify-center rounded-lg text-text">
        <Menu className="size-6" />
      </span>
    </div>
  );
}
