import { LuArrowRight } from "react-icons/lu";
import { Link } from "@/i18n/navigation";
import { Spotlight } from "./Spotlight";

/** "View all … · N items →" pill under a home-page section that only shows its first few items. */
export function ViewAllLink({ href, label, count }: { href: string; label: string; count: string }) {
  return (
    <Link
      href={href}
      className="group/all inline-flex rounded-full transition-transform duration-150 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Spotlight
        reactiveShadow
        shadowScale={0.4}
        size={140}
        className="inline-flex items-center gap-3 rounded-full border border-accent/40 py-2.5 pl-5 pr-2.5 font-display text-accent hover:border-accent group-active/all:bg-accent/15"
        contentClassName="inline-flex items-center gap-3"
      >
        {label}
        <span className="rounded-full bg-accent-strong/15 px-2.5 py-0.5 text-xs text-accent-soft">{count}</span>
        <LuArrowRight className="size-4 transition-transform group-hover/all:translate-x-1" aria-hidden />
      </Spotlight>
    </Link>
  );
}
