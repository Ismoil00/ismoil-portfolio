"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LuSparkles, LuX } from "react-icons/lu";
import { useDismiss } from "@/components/ui/useDismiss";
import { CHAT_PANEL } from "@/lib/chat";
import { lockScroll } from "@/lib/scroll-lock";
import { ChatPanel } from "./ChatPanel";

const PHONE = "(max-width: 639px)";

/**
 * The AI assistant's button (bottom right) and its panel: a panel above the button on larger screens, the
 * whole screen on phones. It closes with the X, Escape or a click outside it.
 *
 * The button is there from the start, cookie choice or not. While the cookie banner is showing, the button
 * moves up above it wherever the two would meet (the banner publishes its height as
 * --consent-banner-space), and while the chat is open the banner steps aside (CHAT_PANEL event).
 */
export function ChatWidget({ name }: { name: string }) {
  const t = useTranslations("chat");
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false); // the panel stays mounted once opened: the chat lives on
  const [phone, setPhone] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia(PHONE);
    const onMedia = () => setPhone(media.matches);
    onMedia();
    media.addEventListener("change", onMedia);
    return () => media.removeEventListener("change", onMedia);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(CHAT_PANEL, { detail: open }));
  }, [open]);

  useEffect(() => {
    if (open && phone) return lockScroll();
  }, [open, phone]);

  const close = useCallback(() => {
    setOpen(false);
    button.current?.focus({ preventScroll: true });
  }, []);
  useDismiss(box, open, close);

  return (
    <div ref={box}>
      {opened && <ChatPanel id={panelId} open={open} phone={phone} name={name} onClose={close} />}
      {/* Closed: a pill that says what it is ("✦ Ask AI"), with a halo that pulses a few times when it
          appears. Open: a round ✕. The spoken name always includes "AI assistant". */}
      <button
        ref={button}
        type="button"
        aria-label={open ? t("close") : undefined}
        aria-expanded={open}
        aria-controls={opened ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={() => {
          setOpened(true);
          setOpen((v) => !v);
        }}
        className={`group fixed bottom-5 right-5 z-40 mr-[var(--scrollbar-lock,0px)] inline-flex h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-accent to-accent-strong font-display text-sm font-semibold text-bg shadow-lg shadow-accent-strong/30 transition-all duration-300 hover:brightness-110 max-[1139px]:bottom-[calc(1.25rem+var(--consent-banner-space,0px))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:animate-fade-up light:text-white ${open ? "w-14" : "pl-4 pr-5"} ${open && phone ? "hidden" : ""}`}
      >
        {open ? (
          <LuX className="size-6" aria-hidden />
        ) : (
          <>
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-accent motion-safe:animate-ai-halo" />
            <LuSparkles className="size-5 motion-safe:animate-twinkle" aria-hidden />
            <span>{t("launcher")}</span>
            <span className="sr-only">: {t("open")}</span>
          </>
        )}
      </button>
    </div>
  );
}
