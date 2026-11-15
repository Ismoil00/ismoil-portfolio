"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** How fast the line follows the scroll (rad/s). Higher = snappier, lower = floatier. */
const FOLLOW_SPEED = 8;

/**
 * Vertical timeline whose glowing line grows with scroll (both directions).
 *
 * - The line's target is a point at 62% of the viewport height.
 * - The tip doesn't jump to that target: it follows it like a critically damped spring, so it
 *   speeds up gently, then slows down and settles without bouncing (ease-in-out).
 * - When the tip passes an item's dot, the item gets `data-alive` and turns from grey to color;
 *   scrolling back up removes it again.
 * - Values are written straight to the DOM inside requestAnimationFrame (no React re-renders);
 *   the animation loop only runs while the tip is still moving.
 * - A ResizeObserver/MutationObserver re-measure when items change ("Show more", filters).
 * - With "reduce motion" turned on in the OS, the tip follows the scroll directly.
 * Styles live in globals.css (.tl-*).
 */
export function ExperienceTimeline({
  children,
  reviveFirst = false,
}: {
  children: ReactNode;
  /** Light up the first item as soon as the list is on screen (for pages that open on the list). */
  reviveFirst?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;
    let lastTime = 0;
    let shown = 0; // where the tip is drawn (px from the top of the list)
    let velocity = 0; // px/s

    /** Where the tip should end up for the current scroll position. */
    const measureGoal = (rect: DOMRect) => {
      let goal = Math.max(0, Math.min(rect.height, window.innerHeight * 0.62 - rect.top));
      if (reviveFirst && rect.top < window.innerHeight) {
        const first = el.querySelector<HTMLElement>("[data-timeline-dot]")?.getBoundingClientRect();
        if (first) goal = Math.max(goal, first.top + first.height / 2 - rect.top + 1);
      }
      return goal;
    };

    const paint = (rect: DOMRect) => {
      const progress = Math.max(0, Math.min(rect.height, shown));
      el.style.setProperty("--tl-progress", `${progress.toFixed(1)}px`);
      el.dataset.tlState = progress < 0.5 ? "idle" : progress >= rect.height - 0.5 ? "done" : "active";

      el.querySelectorAll<HTMLElement>("[data-timeline-dot]").forEach((dot) => {
        const item = dot.parentElement;
        if (!item) return;
        const d = dot.getBoundingClientRect();
        const reached = progress >= d.top + d.height / 2 - rect.top;
        if (reached) item.setAttribute("data-alive", "");
        else item.removeAttribute("data-alive");
      });
    };

    const tick = (now: number) => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const goal = measureGoal(rect);

      if (reducedMotion.matches) {
        shown = goal;
        velocity = 0;
      } else {
        // Critically damped spring: starts from rest (ease-in), settles without overshoot (ease-out).
        const dt = Math.min(1 / 20, Math.max(1 / 240, (now - lastTime) / 1000));
        const accel = FOLLOW_SPEED * FOLLOW_SPEED * (goal - shown) - 2 * FOLLOW_SPEED * velocity;
        velocity += accel * dt;
        shown += velocity * dt;
        if (Math.abs(goal - shown) < 0.5 && Math.abs(velocity) < 8) {
          shown = goal;
          velocity = 0;
        }
      }
      lastTime = now;
      paint(rect);
      if (shown !== goal) frame = requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (frame) return;
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    };

    el.setAttribute("data-timeline-ready", "");
    paint(el.getBoundingClientRect());
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    // Items swapped by filters may keep the same total height — watch the list itself too.
    const mutations = new MutationObserver(schedule);
    mutations.observe(el, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      mutations.disconnect();
    };
  }, [reviveFirst]);

  return (
    <div ref={ref} data-timeline className="relative">
      <span aria-hidden className="tl-track" />
      <span aria-hidden className="tl-line" />
      <span aria-hidden className="tl-tip" />
      <ol className="tl-list space-y-6">{children}</ol>
    </div>
  );
}

/** One row of the timeline: its dot on the line + the card. */
export function TimelineItem({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <li id={id} data-timeline-item className="anchor-target relative">
      <span aria-hidden data-timeline-dot className="tl-dot" />
      <div className="tl-card">{children}</div>
    </li>
  );
}
