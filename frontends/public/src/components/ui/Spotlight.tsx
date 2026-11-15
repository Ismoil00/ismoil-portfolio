"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

/**
 * Card wrapper with a soft blue light that follows the mouse.
 * With `reactiveShadow`, the card also casts a blue glow toward the cursor side:
 * almost none when the cursor is at the center, strongest at the corners.
 * Values are written straight to the DOM (no React re-renders), so it stays smooth.
 * Touch devices simply don't show it.
 */
export function Spotlight({
  children,
  className = "",
  size = 320,
  reactiveShadow = false,
  shadowScale = 1,
  intensity = 1,
  contentClassName = "",
}: {
  children: ReactNode;
  className?: string;
  /** Diameter of the light circle in px. */
  size?: number;
  reactiveShadow?: boolean;
  /** Shrinks the shadow's reach for small elements like buttons (1 = card size). */
  shadowScale?: number;
  /** Brightness of the light and rim (1 = default). */
  intensity?: number;
  /** Classes for the wrapper around children (e.g. to keep a flex layout). */
  contentClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--spot-x", `${x}px`);
    el.style.setProperty("--spot-y", `${y}px`);

    if (reactiveShadow) {
      // Cursor offset from the center, -1 (left/top edge) … 1 (right/bottom edge).
      const dx = Math.max(-1, Math.min(1, (x / rect.width) * 2 - 1));
      const dy = Math.max(-1, Math.min(1, (y / rect.height) * 2 - 1));
      // 0 at the center, 1 in a corner.
      const strength = Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
      const s = shadowScale;
      const offset = 18 * s;
      el.style.boxShadow = [
        `${(dx * offset).toFixed(1)}px ${(dy * offset).toFixed(1)}px ${((20 + strength * 30) * s).toFixed(0)}px ${(-4 * s).toFixed(1)}px rgb(66 135 255 / ${(strength * 0.5).toFixed(2)})`,
        `${(dx * offset * 0.4).toFixed(1)}px ${(dy * offset * 0.4).toFixed(1)}px ${(12 * s).toFixed(0)}px ${(-6 * s).toFixed(1)}px rgb(var(--spot-rim) / ${(strength * 0.35).toFixed(2)})`,
      ].join(", ");
    }
  };

  const onLeave = () => {
    if (reactiveShadow && ref.current) ref.current.style.boxShadow = "";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`group/spot relative overflow-hidden ${
        reactiveShadow ? "transition-[box-shadow,border-color] duration-200 ease-out" : ""
      } ${className}`}
    >
      {/* Light layer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100"
        style={{
          background: `radial-gradient(${size}px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgb(66 135 255 / ${(0.22 * intensity).toFixed(3)}), transparent 65%)`,
        }}
      />
      {/* Brighter rim where the light touches the border — above the content, so it also
          shows over edge-to-edge images (e.g. project thumbnails). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100"
        style={{
          padding: 1,
          background: `radial-gradient(${size * 0.6}px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgb(var(--spot-rim) / ${(0.55 * intensity).toFixed(3)}), transparent 70%)`,
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <div className={`relative ${contentClassName}`}>{children}</div>
    </div>
  );
}
