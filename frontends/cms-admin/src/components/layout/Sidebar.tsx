"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuExternalLink, LuLogOut, LuMenu, LuX } from "react-icons/lu";
import { api } from "@/api/client";
import { lockScroll } from "@/lib/scroll-lock";
import { ThemeToggle } from "./ThemeToggle";
import { navItems } from "./nav-items";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Left menu (fixed on large screens, a drawer on small ones), with theme, "View site" and sign out. */
export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Lock the page behind the drawer while it's open (links close it when clicked).
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

  async function signOut() {
    setSigningOut(true);
    try {
      await api.post("/auth/logout");
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload after signing out
      window.location.href = "/login";
    }
  }

  const menu = (
    <nav aria-label="Sections" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 ${
              active ? "bg-accent/12 font-medium text-accent" : "text-muted hover:bg-tint/5 hover:text-fg"
            }`}
          >
            <Icon className={`size-4.5 shrink-0 transition-transform duration-200 ${active ? "" : "group-hover:scale-110"}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-line p-3">
      <a
        href={siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-tint/5 hover:text-fg"
      >
        <LuExternalLink className="size-4.5" /> View site
      </a>
      <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-faint">Signed in as</p>
          <p className="truncate text-sm" title={email}>
            {email}
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
          className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <LuLogOut className="size-4" />
        </button>
      </div>
    </div>
  );

  const brand = (
    <div className="flex h-16 items-center justify-between gap-3 px-6">
      <Link href="/hero" className="font-display text-xl font-bold tracking-tight">
        IS<span className="text-accent">.</span> <span className="ml-1 text-sm font-medium text-subtle">Admin</span>
      </Link>
      <ThemeToggle />
    </div>
  );

  return (
    <>
      {/* Small screens: top bar with the menu button */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/80 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="grid size-9 place-items-center rounded-full text-muted hover:bg-tint/5 hover:text-fg"
        >
          <LuMenu className="size-5" />
        </button>
        <span className="font-display text-lg font-bold">
          IS<span className="text-accent">.</span>
        </span>
        <ThemeToggle />
      </div>

      {/* Drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-bg/60 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-16 items-center justify-between px-6">
            <span className="font-display text-xl font-bold">
              IS<span className="text-accent">.</span> <span className="ml-1 text-sm font-medium text-subtle">Admin</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="grid size-9 place-items-center rounded-full text-muted hover:bg-tint/5 hover:text-fg"
            >
              <LuX className="size-5" />
            </button>
          </div>
          {menu}
          {footer}
        </aside>
      </div>

      {/* Large screens: fixed column */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-bg/70 backdrop-blur-md lg:flex">
        {brand}
        {menu}
        {footer}
      </aside>
    </>
  );
}
