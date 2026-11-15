"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { LuChevronLeft, LuChevronRight, LuPlay, LuX } from "react-icons/lu";
import type { MediaItem } from "@/types/content";
import { lockScroll } from "@/lib/scroll-lock";

/**
 * Full-screen viewer for images/videos (project galleries, certificate photos), built on
 * <dialog> (modal: focus is trapped, the page behind is inert, Esc closes it).
 * Close: × button, Esc, a click on the dark background, or a click on the image itself.
 * Navigate (when there are several): arrows, ← / → keys, thumbnails, or a swipe on touch screens.
 */
export function Lightbox({
  media,
  index,
  title,
  onIndex,
  onClose,
}: {
  media: MediaItem[];
  index: number;
  title: string;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("lightbox");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; id: number } | null>(null);
  const item = media[index];
  const many = media.length > 1;

  const go = (step: number) => onIndex((index + step + media.length) % media.length);
  const close = () => dialogRef.current?.close(); // fires "close" → onClose

  // Open as a modal and lock the page scroll while it's open.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return lockScroll();
  }, []);

  // Keep the active thumbnail in view.
  useEffect(() => {
    thumbsRef.current
      ?.querySelector<HTMLElement>(`[data-thumb="${index}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, id: e.pointerId };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!many || !start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClose={onClose}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      data-theme="dark"
      className="lightbox m-0 size-full max-h-none max-w-none bg-transparent p-0 text-fg backdrop:bg-[#04060a]/92 backdrop:backdrop-blur-md"
    >
      <div className="flex size-full flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
          <span className="min-w-14 font-display text-sm tabular-nums text-muted">
            {many && t("counter", { current: index + 1, total: media.length })}
          </span>
          <p className="min-w-0 flex-1 truncate text-center font-display text-sm text-fg/80">{title}</p>
          <button
            type="button"
            onClick={close}
            aria-label={t("close")}
            className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong bg-white/[0.04] text-fg transition-[background-color,border-color,transform,translate,scale] hover:border-accent hover:bg-accent/15 active:scale-90"
          >
            <LuX className="size-5" />
          </button>
        </div>

        {/* Media — clicking the empty space around it closes the viewer */}
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {item.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={item.src}
              src={item.src}
              alt={item.alt ?? ""}
              draggable={false}
              onClick={close}
              className="max-h-full max-w-full animate-[lightbox-media_0.25s_ease-out] cursor-zoom-out rounded-lg object-contain shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]"
            />
          ) : (
            <video
              key={item.src}
              src={item.src}
              poster={item.poster ?? undefined}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full animate-[lightbox-media_0.25s_ease-out] rounded-lg bg-black shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]"
            />
          )}

          {many && (
            <>
              <NavButton side="left" label={t("prev")} onClick={() => go(-1)} />
              <NavButton side="right" label={t("next")} onClick={() => go(1)} />
            </>
          )}
        </div>

        {/* Thumbnails */}
        {many && (
          <div ref={thumbsRef} className="flex justify-center-safe gap-2 overflow-x-auto px-4 py-4 [scrollbar-width:none]">
            {media.map((m, i) => (
              <button
                key={`${m.src}-${i}`}
                type="button"
                data-thumb={i}
                onClick={() => onIndex(i)}
                aria-label={t("openItem", { n: i + 1, total: media.length })}
                aria-current={i === index}
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border transition-[opacity,border-color,transform,translate,scale] duration-200 ${
                  i === index
                    ? "border-accent opacity-100 shadow-[0_0_0_2px_rgb(66_135_255/0.5)]"
                    : "border-line opacity-50 hover:opacity-90"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.type === "video" ? (m.poster ?? "") : m.src} alt="" className="size-full object-cover" />
                {m.type === "video" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <LuPlay className="size-4 fill-white text-white" aria-hidden />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}

function NavButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  const Icon = side === "left" ? LuChevronLeft : LuChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-[#0e121a]/80 text-fg backdrop-blur transition-[background-color,border-color,transform,translate,scale] hover:border-accent hover:bg-accent/20 active:scale-90 sm:inline-flex ${
        side === "left" ? "left-4" : "right-4"
      }`}
    >
      <Icon className="size-6" />
    </button>
  );
}
