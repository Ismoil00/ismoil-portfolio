/**
 * Geometry for the "Other links" fan: circles on gentle arcs stacked beside the button that
 * opens them — above it ("up", the Contact tile) or to its right ("right", the side rail).
 *
 * All arcs share one center, placed far behind the button (`bend`), so each arc is only a
 * shallow curve, not a half-circle. The arc closest to the button is the shortest (fewest
 * circles); each next arc is one `step` further out and opens a few degrees wider, so it holds
 * more. Circles are spread evenly along an arc; the last, partly filled arc is centered. An arc
 * only uses the part that stays on screen and clear of the button, so on small screens arcs are
 * shorter and there are more of them.
 */

export type ArcDirection = "up" | "right";

export interface ArcMetrics {
  /** Circle diameter. */
  d: number;
  /** Item width (the name under the circle wraps within it). */
  w: number;
  /** Space under the circle: gap + up to two lines of the name. */
  below: number;
  /** Minimum distance between neighbouring circle centers on one arc. */
  spacing: number;
  /** Distance between arcs. */
  step: number;
  /** How far behind the button the arcs' common center is — bigger = flatter arcs. */
  bend: number;
  /** Half-opening of the first arc (degrees), growth per arc, and the cap. */
  fan0: number;
  fanGrow: number;
  fanMax: number;
  /** Clearance from the button, and from the screen edges. */
  gap: number;
  margin: number;
}

export const LARGE: ArcMetrics = {
  d: 56, w: 84, below: 40, spacing: 92, step: 104, bend: 560, fan0: 14, fanGrow: 4, fanMax: 30, gap: 14, margin: 16,
};
export const SMALL: ArcMetrics = {
  d: 48, w: 74, below: 36, spacing: 80, step: 92, bend: 420, fan0: 14, fanGrow: 4, fanMax: 30, gap: 10, margin: 10,
};
/** Opening to the right: neighbours on an arc are stacked vertically (circle + name), so they need more room. */
export const SIDE: ArcMetrics = { ...LARGE, spacing: 104, gap: 20 };

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
const DEG = Math.PI / 180;

/**
 * Circle centers in the button's own frame: `out` = distance away from the button's edge,
 * `along` = offset along that edge (negative = left / up). `room` = how far a center may go
 * along the edge on each side before leaving the screen; `minOut` = the closest a center may be
 * to the button's edge.
 */
export function arcPositions(
  count: number,
  room: { neg: number; pos: number },
  minOut: number,
  m: ArcMetrics,
) {
  const c = m.bend; // the common center is `c` px behind the button's edge
  // First arc: its two ends sit exactly `minOut` from the button.
  const r0 = (c + minOut) / Math.cos(m.fan0 * DEG);
  const out: { along: number; out: number }[] = [];

  for (let k = 0, r = r0; out.length < count && k < 80; k++, r += m.step) {
    // Usable half-opening around the straight-out direction, the same on both sides so every
    // arc stays level with the button: limited by the fan width, the button, and the screen.
    const spread = Math.min(
      Math.min(m.fanMax, m.fan0 + k * m.fanGrow) * DEG,
      Math.acos(Math.min(1, (c + minOut) / r)), // wider, and a circle would touch the button
      Math.asin(clamp1(room.pos / r)),
      Math.asin(clamp1(room.neg / r)),
    );
    if (spread < 0) continue;
    const lo = Math.PI / 2 - spread;
    const hi = Math.PI / 2 + spread;

    const minAngle = 2 * Math.asin(Math.min(1, m.spacing / (2 * r))); // chord = spacing
    const capacity = Math.floor((hi - lo) / minAngle + 1e-9) + 1;
    const n = Math.min(capacity, count - out.length);
    const angle = capacity > 1 ? (hi - lo) / (capacity - 1) : 0;
    const mid = (lo + hi) / 2;
    for (let j = 0; j < n; j++) {
      const a = mid + ((n - 1) / 2 - j) * angle; // negative side → positive side
      out.push({ along: r * Math.cos(a), out: r * Math.sin(a) - c });
    }
  }
  return out;
}

/**
 * Everything the overlay needs, measured from the button's current place on screen.
 * `points` are circle centers in screen coordinates; `from` is where they fly out of.
 */
export function measureArcs(button: HTMLElement, count: number, direction: ArcDirection) {
  const rect = button.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const from = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

  if (direction === "right") {
    const m = SIDE;
    const oy = from.y;
    const raw = arcPositions(
      count,
      { neg: oy - m.margin - m.d / 2, pos: vh - m.margin - m.d / 2 - m.below - oy },
      m.w / 2 + m.gap, // the name is the widest part of an item
      m,
    );
    const points = raw.map((p) => ({ x: rect.right + p.out, y: oy + p.along }));
    return { rect, m, from, points, deficit: 0 };
  }

  const m = vw < 640 ? SMALL : LARGE;
  const raw = arcPositions(
    count,
    { neg: from.x - m.margin - m.w / 2, pos: vw - m.margin - m.w / 2 - from.x },
    m.d / 2 + m.below + m.gap, // a circle's name must end above the tile
    m,
  );
  const points = raw.map((p) => ({ x: from.x + p.along, y: rect.top - p.out }));
  // Height the fan needs above the tile's top edge (outermost circle + margin).
  const needed = Math.max(0, ...raw.map((p) => p.out)) + m.d / 2 + m.margin;
  return { rect, m, from, points, deficit: Math.max(0, needed - rect.top) };
}

export type ArcLayout = ReturnType<typeof measureArcs> & {
  /** When the fan is taller than the space above the tile even after scrolling: extra stage height. */
  extra: number;
};
