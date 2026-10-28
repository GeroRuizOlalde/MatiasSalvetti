import { signInWithTwitch } from "@/app/auth/actions";
import { BrandIcon } from "@/components/ui/brand-icon";
import { buttonClasses } from "@/components/ui/button";
import { CurrentPathInput } from "./current-path-input";

/** Sin `next`, vuelve a la página actual después del login. */
export function LoginButton({
  next,
  label = "Entrar con Twitch",
  size = "sm",
  className,
}: {
  next?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <form action={signInWithTwitch} className={className}>
      {next ? <input type="hidden" name="next" value={next} /> : <CurrentPathInput />}
      <button type="submit" className={buttonClasses({ variant: "primary", size, className: "w-full" })}>
        <BrandIcon name="twitch" className="size-4" />
        {label}
      </button>
    </form>
  );
}
