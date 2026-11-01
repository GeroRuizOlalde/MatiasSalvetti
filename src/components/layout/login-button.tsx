import { signInWithTwitch } from "@/app/auth/actions";
import { BrandIcon } from "@/components/ui/brand-icon";
import { buttonClasses } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { CurrentPathInput } from "./current-path-input";

/** Sin `next`, vuelve a la página actual después del login. */
export function LoginButton({
  next,
  label,
  size = "sm",
  className,
  lang = "es",
}: {
  next?: string;
  label?: string;
  lang?: Locale;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <form action={signInWithTwitch} className={className}>
      {next ? <input type="hidden" name="next" value={next} /> : <CurrentPathInput />}
      <button type="submit" className={buttonClasses({ variant: "primary", size, className: "w-full" })}>
        <BrandIcon name="twitch" className="size-4" />
        {label ?? getI18n(lang).t.userMenu.signIn}
      </button>
    </form>
  );
}
