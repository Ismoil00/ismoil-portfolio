"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { LuChevronLeft, LuChevronRight, LuExpand, LuPlay } from "react-icons/lu";
import type { MediaItem } from "@/types/content";
import { Lightbox } from "@/components/media/Lightbox";

/** Scroll position of the strip → arrows, edge fades and the progress thumb. */
function measure(el: HTMLElement) {
  const max = el.scrollWidth - el.clientWidth;
  return {
    atStart: el.scrollLeft <= 2,
    atEnd: el.scrollLeft >= max - 2,
    /** Visible share of the strip (thumb width) and how far it's scrolled (0…1). */
    visible: el.scrollWidth ? Math.min(1, el.clientWidth / el.scrollWidth) : 1,
    progress: max > 0 ? el.scrollLeft / max : 0,
  };
}

/**
 * Horizontal film strip of the project's images and videos.
 * - Every item keeps its own proportions at one shared height (phone screens stay narrow,
 *   desktop screens wide), and snaps into place.
 * - Scroll with the arrows, the trackpad/wheel, ← / → keys, a swipe, or by dragging with the mouse.
 * - A click opens the item full screen (Lightbox).
 */
export function ProjectGallery({ media, title }: { media: MediaItem[]; title: string }) {
  const t = useTranslations("projectPage");
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, x: 0, left: 0 });
  const [state, setState] = useState({ atStart: true, atEnd: true, visible: 1, progress: 0 });
  const [open, setOpen] = useState<number | null>(null);
  const many = media.length > 1;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setState(measure(el)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: "smooth" });
  };

  // Drag-to-scroll with the mouse (touch already scrolls natively).
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { active: true, moved: false, x: e.clientX, left: e.currentTarget.scrollLeft };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.dragging = "";
    }
    if (d.moved) e.currentTarget.scrollLeft = d.left - dx;
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    delete e.currentTarget.dataset.dragging;
  };

  const fade = (on: boolean) => (on ? "transparent" : "#000");
  const mask = `linear-gradient(to right, ${fade(!state.atStart)}, #000 40px, #000 calc(100% - 40px), ${fade(!state.atEnd)})`;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={t("gallery")}
        tabIndex={0}
        onScroll={(e) => setState(measure(e.currentTarget))}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") scrollByPage(1);
          if (e.key === "ArrowLeft") scrollByPage(-1);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          // A drag shouldn't count as a click on the item under the mouse.
          if (drag.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            drag.current.moved = false;
          }
        }}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        className={`gallery-track flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain rounded-2xl [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent [&::-webkit-scrollbar]:hidden ${
          many ? "" : "justify-center"
        }`}
      >
        {media.map((item, i) => (
          <button
            key={`${item.src}-${i}`}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={t("openItem", { n: i + 1, total: media.length })}
            className="gallery-slide group/slide relative h-[clamp(240px,42vw,460px)] max-w-full shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-bg transition-[border-color,box-shadow] duration-300 hover:border-accent/50 hover:shadow-[0_18px_50px_-18px_rgb(66_135_255/0.55)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            style={{ aspectRatio: `${item.width ?? 16} / ${item.height ?? 9}` }}
          >
            {item.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.src}
                alt={item.alt ?? `${title} — ${i + 1}`}
                draggable={false}
                loading={i < 2 ? "eager" : "lazy"}
                decoding="async"
                className="size-full object-cover transition-transform duration-500 group-hover/slide:scale-[1.02]"
              />
            ) : (
              <>
                <video
                  src={item.src}
                  poster={item.poster ?? undefined}
                  muted
                  playsInline
                  preload="metadata"
                  className="pointer-events-none size-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <span className="inline-flex size-16 items-center justify-center rounded-full border border-white/30 bg-black/40 backdrop-blur transition-transform duration-300 group-hover/slide:scale-110">
                    <LuPlay className="ml-1 size-7 fill-white text-white" aria-hidden />
                  </span>
                </span>
              </>
            )}
            <span className="pointer-events-none absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover/slide:opacity-100 group-focus-visible/slide:opacity-100">
              <LuExpand className="size-4" aria-hidden />
            </span>
          </button>
        ))}
      </div>

      {many && (
        <>
          <ArrowButton side="left" hidden={state.atStart} label={t("prev")} onClick={() => scrollByPage(-1)} />
          <ArrowButton side="right" hidden={state.atEnd} label={t("next")} onClick={() => scrollByPage(1)} />
        </>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-subtle">
        {state.visible < 1 && (
          // Custom scrollbar: shows how much of the strip is visible and where you are.
          <div aria-hidden className="relative h-1 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className="absolute inset-y-0 rounded-full bg-gradient-to-r from-accent-strong to-accent transition-[left] duration-150 ease-out"
              style={{ width: `${state.visible * 100}%`, left: `${state.progress * (1 - state.visible) * 100}%` }}
            />
          </div>
        )}
        <p className="ml-auto flex max-w-[60%] items-start gap-1.5 text-right sm:max-w-none">
          <LuExpand className="mt-px size-3.5 shrink-0" aria-hidden />
          {t("enlargeHint", { count: media.length })}
        </p>
      </div>

      {open !== null && (
        <Lightbox
          media={media}
          index={open}
          title={title}
          onIndex={setOpen}
          onClose={() => {
            // Bring the last viewed item into view in the strip.
            trackRef.current?.children[open]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function ArrowButton({
  side,
  hidden,
  label,
  onClick,
}: {
  side: "left" | "right";
  hidden: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = side === "left" ? LuChevronLeft : LuChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      tabIndex={hidden ? -1 : 0}
      className={`absolute top-[calc(clamp(240px,42vw,460px)/2)] z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-surface/85 text-fg shadow-[0_10px_30px_-10px_var(--pop-shadow)] backdrop-blur transition-[opacity,background-color,border-color,transform,translate,scale] duration-200 hover:border-accent hover:bg-accent/20 active:scale-90 md:inline-flex ${
        side === "left" ? "-left-3 lg:-left-6" : "-right-3 lg:-right-6"
      } ${hidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <Icon className="size-6" />
    </button>
  );
}
