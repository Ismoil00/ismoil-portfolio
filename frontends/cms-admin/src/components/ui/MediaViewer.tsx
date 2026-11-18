"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { LuChevronLeft, LuChevronRight, LuPlay, LuX } from "react-icons/lu";
import { lockScroll } from "@/lib/scroll-lock";
import type { Media } from "@/types/api";

const isVideo = (m: Media) => m.content_type.startsWith("video/");

/**
 * Full-screen viewer for uploaded images and videos, so they can be checked after upload — the
 * public site's lightbox in the admin. Built on <dialog> (modal: focus is trapped, Esc closes).
 * Close: × button, Esc, a click on the dark background or on the image. Several files: arrows,
 * ← / → keys, thumbnails, or a swipe on touch screens. Videos play with sound and controls.
 */
export function MediaViewer({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: Media[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; id: number } | null>(null);
  const item = items[index];
  const many = items.length > 1;

  const go = (step: number) => onIndex((index + step + items.length) % items.length);
  const close = () => dialogRef.current?.close(); // fires "close" → onClose

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return lockScroll();
  }, []);

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

  if (!item) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label={item.original_name}
      onClose={onClose}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      className="media-viewer m-0 size-full max-h-none max-w-none bg-transparent p-0 text-white backdrop:bg-[#04060a]/92 backdrop:backdrop-blur-md"
    >
      <div className="flex size-full flex-col">
        <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
          <span className="min-w-14 font-display text-sm tabular-nums text-white/60">{many && `${index + 1} / ${items.length}`}</span>
          <p className="min-w-0 flex-1 truncate text-center font-display text-sm text-white/80">{item.original_name}</p>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="inline-flex size-11 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] transition-[background-color,border-color,scale] hover:border-accent hover:bg-accent/15 active:scale-90"
          >
            <LuX className="size-5" />
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {isVideo(item) ? (
            <video
              key={item.id}
              src={item.url}
              poster={item.poster_url ?? undefined}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full animate-[viewer-media_0.25s_ease-out] rounded-lg bg-black shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded file
            <img
              key={item.id}
              src={item.url}
              alt={item.original_name}
              draggable={false}
              onClick={close}
              className="max-h-full max-w-full animate-[viewer-media_0.25s_ease-out] cursor-zoom-out rounded-lg object-contain shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]"
            />
          )}

          {many && (
            <>
              <NavButton side="left" onClick={() => go(-1)} />
              <NavButton side="right" onClick={() => go(1)} />
            </>
          )}
        </div>

        {many && (
          <div ref={thumbsRef} className="flex justify-center-safe gap-2 overflow-x-auto px-4 py-4 [scrollbar-width:none]">
            {items.map((m, i) => (
              <button
                key={m.id}
                type="button"
                data-thumb={i}
                onClick={() => onIndex(i)}
                aria-label={`Show ${m.original_name}`}
                aria-current={i === index}
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border transition-[opacity,border-color] duration-200 ${
                  i === index ? "border-accent opacity-100 shadow-[0_0_0_2px_rgb(66_135_255/0.5)]" : "border-white/15 opacity-50 hover:opacity-90"
                }`}
              >
                {(isVideo(m) ? m.poster_url : m.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded file
                  <img src={(isVideo(m) ? m.poster_url : m.url) ?? ""} alt="" className="size-full object-cover" />
                ) : (
                  <span className="block size-full bg-white/10" />
                )}
                {isVideo(m) && (
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

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? LuChevronLeft : LuChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={`absolute top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#0e121a]/80 backdrop-blur transition-[background-color,border-color,scale] hover:border-accent hover:bg-accent/20 active:scale-90 sm:inline-flex ${
        side === "left" ? "left-4" : "right-4"
      }`}
    >
      <Icon className="size-6" />
    </button>
  );
}
