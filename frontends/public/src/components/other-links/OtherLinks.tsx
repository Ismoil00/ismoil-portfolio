"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LuChevronDown, LuGlobe, LuLink } from "react-icons/lu";
import type { OtherLink } from "@/types/content";
import { themedBrandColor } from "@/lib/brand-color";
import { Spotlight } from "@/components/ui/Spotlight";
import { SvgIcon } from "@/components/ui/SvgIcon";
import { Tooltip } from "@/components/ui/Tooltip";
import { contactTileClass, railButtonClass } from "@/components/ui/contact-styles";
import { lockScroll } from "@/lib/scroll-lock";
import { measureArcs, type ArcLayout } from "./arc-layout";

/** Timings (ms) — keep in sync with `.arc-*` in globals.css. */
const openStagger = (n: number) => Math.min(17.5, 300 / n);
const closeStagger = (n: number) => Math.min(10, 150 / n);
const closeDuration = (n: number) => closeStagger(n) * (n - 1) + 240;

/**
 * "Other links" button. Clicking it opens a layer over the page (the page behind is dimmed and
 * blurred, nothing moves): one circle per link flies out of the button onto arcs beside it —
 * see `arc-layout.ts` — and floats gently. Clicking the button again, outside the circles or
 * pressing Esc sends them back into the button.
 *
 * `variant`: "tile" = the Contact section's tile, circles open upwards; "rail" = the round icon
 * in the fixed side rail, circles open to the right. Everything else is the same.
 */
export function OtherLinks({ links, variant = "tile" }: { links: OtherLink[]; variant?: "tile" | "rail" }) {
  const t = useTranslations("contact");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);
  const unlockRef = useRef<(() => void) | null>(null);
  const [layout, setLayout] = useState<ArcLayout | null>(null);
  const [shown, setShown] = useState(false);
  const dialogId = useId();
  const isOpen = layout !== null;
  const direction = variant === "rail" ? "right" : "up";
  const title = t("otherLinks");
  const count = t("otherLinksCount", { count: links.length });

  const unlockScroll = () => {
    unlockRef.current?.();
    unlockRef.current = null;
  };

  const open = () => {
    const trigger = triggerRef.current;
    if (!trigger || isOpen) return;
    unlockRef.current = lockScroll();
    let next = measureArcs(trigger, links.length, direction);
    // Not enough room above the tile: scroll the page so the tile moves down (as far as it can).
    // (The rail is fixed to the screen, so scrolling would not move it.)
    if (next.deficit > 0) {
      const room = window.innerHeight - next.m.margin - next.rect.bottom;
      const shift = Math.min(next.deficit, Math.max(0, room));
      if (shift > 0) {
        window.scrollBy({ top: -shift, behavior: "instant" });
        next = measureArcs(trigger, links.length, direction);
      }
    }
    closingRef.current = false;
    setLayout({ ...next, extra: next.deficit });
  };

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setShown(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => dialogRef.current?.close(), reduce ? 0 : closeDuration(links.length));
  };

  // Once the layer is in the DOM: show it, then (next frames) let the circles fly out.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!layout || !dialog || closingRef.current) return;
    if (!dialog.open) dialog.showModal();
    // Keeps the button copy exactly over the real button (also after a resize re-measure).
    dialog.scrollTop = layout.extra;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [layout]);

  // The button moved while open — screen resized/rotated, or it was clicked while its column was
  // still sliding in (scroll-reveal) — re-place the copy and the circles around its new position.
  // If the screen got too small for the button (the rail hides itself), close instead.
  useEffect(() => {
    if (!isOpen) return;
    const remeasure = () => {
      const trigger = triggerRef.current;
      if (!trigger || closingRef.current) return;
      if (trigger.getBoundingClientRect().width === 0) {
        dialogRef.current?.close();
        return;
      }
      const next = measureArcs(trigger, links.length, direction);
      setLayout({ ...next, extra: next.deficit });
    };
    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.target instanceof Node && e.target.contains(triggerRef.current)) remeasure();
    };
    window.addEventListener("resize", remeasure);
    document.addEventListener("transitionend", onTransitionEnd);
    return () => {
      window.removeEventListener("resize", remeasure);
      document.removeEventListener("transitionend", onTransitionEnd);
    };
  }, [isOpen, links.length, direction]);

  // Leaving the page while open: give the scroll back.
  useEffect(() => () => unlockScroll(), []);

  const onDialogClose = () => {
    unlockScroll();
    setLayout(null);
    setShown(false);
    closingRef.current = false;
    triggerRef.current?.focus({ preventScroll: true });
  };

  const triggerProps = {
    ref: triggerRef,
    type: "button" as const,
    onClick: open,
    "aria-haspopup": "dialog" as const,
    "aria-expanded": isOpen,
    "aria-controls": dialogId,
  };

  return (
    <>
      {variant === "rail" ? (
        <Tooltip label={title} side="right">
          <button {...triggerProps} aria-label={`${title} — ${count}`} className={railButtonClass}>
            <LuLink className="size-5 text-accent" aria-hidden />
          </button>
        </Tooltip>
      ) : (
        <button {...triggerProps} className={contactTileClass}>
          <TileContent title={title} count={count} />
        </button>
      )}

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-label={title}
        onCancel={(e) => {
          e.preventDefault(); // Esc: animate back first, then close
          close();
        }}
        onClose={onDialogClose}
        className="m-0 size-full max-h-none max-w-none overflow-y-auto overscroll-contain bg-transparent p-0 text-fg backdrop:bg-transparent"
      >
        {layout && (
          <Stage
            layout={layout}
            links={links}
            shown={shown}
            onClose={close}
            copyClassName={
              variant === "rail"
                ? "flex items-center justify-center rounded-full bg-surface ring-1 ring-accent/50 hover:ring-accent/80"
                : "flex items-center gap-3 rounded-xl border border-accent/40 bg-surface px-4 py-3 text-left hover:border-accent/70"
            }
          >
            {variant === "rail" ? (
              <LuLink className="size-5 text-accent" aria-hidden />
            ) : (
              <TileContent title={title} count={count} open />
            )}
          </Stage>
        )}
      </dialog>
    </>
  );
}

function TileContent({ title, count, open = false }: { title: string; count: string; open?: boolean }) {
  return (
    <>
      <LuLink className="size-5 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm text-fg">{title}</span>
        <span className="block text-xs text-subtle">{count}</span>
      </span>
      <LuChevronDown
        className={`size-4 shrink-0 text-subtle transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        aria-hidden
      />
    </>
  );
}

/** The layer: dimmed/blurred backdrop, a copy of the button (sharp, on top), and the circles. */
function Stage({
  layout,
  links,
  shown,
  onClose,
  copyClassName,
  children,
}: {
  layout: ArcLayout;
  links: OtherLink[];
  shown: boolean;
  onClose: () => void;
  copyClassName: string;
  children: ReactNode;
}) {
  const { rect, m, from, points, extra } = layout;
  const n = links.length;
  const stageStyle = {
    height: `calc(100dvh + ${extra}px)`,
    "--so": openStagger(n),
    "--sc": closeStagger(n),
    // Closing: the backdrop clears as the last circle lands back in the button.
    "--bd-delay": `${Math.max(0, closeDuration(n) - 175)}ms`,
  } as CSSProperties;

  return (
    <div className="arc-stage relative" data-shown={shown || undefined} style={stageStyle}>
      <div className="arc-backdrop absolute inset-0 bg-bg/55 backdrop-blur-[6px]" onClick={onClose} aria-hidden />

      <button
        type="button"
        onClick={onClose}
        aria-expanded
        className={`absolute transition-[color,border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${copyClassName}`}
        style={{ left: rect.left, top: rect.top + extra, width: rect.width, height: rect.height }}
      >
        {children}
      </button>

      <ul className="pointer-events-none absolute inset-0">
        {links.map((link, i) => {
          const p = points[i];
          if (!p) return null;
          const y = p.y + extra;
          const style = {
            left: p.x - m.w / 2,
            top: y - m.d / 2,
            width: m.w,
            "--i": i,
            "--ri": n - 1 - i,
            "--fx": `${from.x - p.x}px`,
            "--fy": `${from.y + extra - y}px`,
            // Each circle floats at its own pace, so they never move in sync.
            "--float-dur": `${5 + ((i * 7) % 5) * 0.6}s`,
            "--float-delay": `${-((i * 13) % 9) * 0.5}s`,
          } as CSSProperties;
          return (
            <li key={link.id} className="arc-orb absolute" style={style}>
              <div className="orb-float">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/orb pointer-events-auto flex flex-col items-center gap-1.5 rounded-lg text-center outline-none"
                >
                  {/* Hover: a small light follows the mouse inside the circle and the circle casts
                      a glow toward the cursor (same Spotlight as the cards, scaled down). */}
                  <span
                    className="block rounded-full transition-[scale] duration-200 group-hover/orb:scale-[1.06] group-focus-visible/orb:outline-2 group-focus-visible/orb:outline-offset-2 group-focus-visible/orb:outline-accent"
                    style={{ width: m.d, height: m.d }}
                  >
                    <Spotlight
                      reactiveShadow
                      size={Math.round(m.d * 0.75)}
                      shadowScale={0.35}
                      intensity={1.3}
                      className="size-full rounded-full border border-line-strong bg-surface text-accent shadow-[0_6px_20px_-8px_var(--pop-shadow)] hover:border-accent/60"
                      contentClassName="flex size-full items-center justify-center"
                    >
                      {/* Platform icon in its brand color (or the accent); no icon → a globe. */}
                      {link.icon ? (
                        <SvgIcon
                          svg={link.icon}
                          color={link.color ? themedBrandColor(link.color) : null}
                          className="size-[44%]"
                        />
                      ) : (
                        <LuGlobe className="size-[44%]" aria-hidden />
                      )}
                    </Spotlight>
                  </span>
                  <span className="line-clamp-2 text-[11px] leading-tight text-fg/85 transition-colors group-hover/orb:text-fg sm:text-xs">
                    {link.label}
                  </span>
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
