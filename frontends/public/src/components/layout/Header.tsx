"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LuMenu, LuX, LuDownload } from "react-icons/lu";
import { Link, usePathname } from "@/i18n/navigation";
import { Container } from "@/components/ui/Container";
import { Spotlight } from "@/components/ui/Spotlight";
import { lockScroll } from "@/lib/scroll-lock";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import type { NavItem } from "./nav-items";

/** `navItems`: the sections to link, from `visibleNavItems` (sections without data are left out). */
export function Header({ resumeUrl, navItems }: { resumeUrl: string; navItems: NavItem[] }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Section links are plain #anchors on the home page; on other pages (e.g. /experience)
  // they lead back to the home page at that section.
  const isHome = usePathname() === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Menu open: the page behind stays put (scroll locked) and Esc closes it.
  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    // pr: while an overlay hides the scrollbar, keep the header's content where it was (scroll-lock.ts).
    <header
      className={`fixed inset-x-0 top-0 z-50 pr-[var(--scrollbar-lock,0px)] transition-colors duration-300 ${
        scrolled || open ? "border-b border-line bg-bg/80 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-lg font-bold tracking-tight" onClick={() => setOpen(false)}>
          IS<span className="text-accent">.</span>
        </Link>

        {/* Inline links from xl: the header is capped at max-w-6xl, and 7 links + language switcher +
            Resume only fit there in every language (Tajik labels are the longest). Below xl: the menu. */}
        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-6">
            {navItems.map((item) => (
              <li key={item}>
                <NavLink
                  item={item}
                  isHome={isHome}
                  className="whitespace-nowrap font-display text-[13px] uppercase tracking-wider text-muted transition-colors hover:text-accent"
                >
                  {t(item)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <LanguageSwitcher />
          {/* Same mouse-follow light + directional shadow as the hero/about cards, scaled down.
              Click: presses in. */}
          <a
            href={resumeUrl}
            download
            className="group/resume hidden rounded-full transition-transform duration-150 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex"
          >
            <Spotlight
              reactiveShadow
              shadowScale={0.35}
              size={110}
              className="inline-flex items-center gap-2 rounded-full border border-accent/40 px-4 py-2 font-display text-sm text-accent hover:border-accent group-active/resume:bg-accent/15"
            >
              <span className="inline-flex items-center gap-2 transition-colors group-hover/resume:text-accent-soft">
                {t("resume")}
                <LuDownload
                  className="size-4 transition-transform duration-200 group-hover/resume:translate-y-0.5"
                  aria-hidden
                />
              </span>
            </Spotlight>
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t("close") : t("menu")}
            className="inline-flex size-10 items-center justify-center rounded-full border border-line text-fg xl:hidden"
          >
            {open ? <LuX className="size-5" /> : <LuMenu className="size-5" />}
          </button>
        </div>
      </Container>

      {/* Mobile / tablet menu */}
      <div
        id="mobile-menu"
        className={`overflow-hidden transition-[max-height] duration-300 xl:hidden ${open ? "max-h-[100svh]" : "max-h-0"}`}
      >
        <nav aria-label="Mobile">
          <Container className="flex h-[calc(100svh-4rem)] flex-col justify-between pb-10 pt-6">
            <ul className="flex flex-col gap-1">
              {navItems.map((item, i) => (
                <li key={item}>
                  <NavLink
                    item={item}
                    isHome={isHome}
                    onClick={() => setOpen(false)}
                    className="flex items-baseline gap-4 border-b border-line py-4 font-display text-2xl text-fg transition-colors hover:text-accent sm:text-3xl"
                  >
                    <span className="text-xs text-faint">0{i + 1}</span>
                    {t(item)}
                  </NavLink>
                </li>
              ))}
            </ul>
            <a
              href={resumeUrl}
              download
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-display font-medium text-bg"
            >
              {t("resume")}
              <LuDownload className="size-4" aria-hidden />
            </a>
          </Container>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  item,
  isHome,
  className,
  onClick,
  children,
}: {
  item: string;
  isHome: boolean;
  className: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return isHome ? (
    <a href={`#${item}`} onClick={onClick} className={className}>
      {children}
    </a>
  ) : (
    <Link href={`/#${item}`} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
