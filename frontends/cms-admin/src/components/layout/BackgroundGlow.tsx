/**
 * Soft animated blue light blobs behind the page, like the reference site's purple ones, and a
 * faint grid at the top. On the light theme the blobs are lighter blues, so the page stays airy
 * instead of hazy, and the grid lines turn navy.
 */
export function BackgroundGlow() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-40 -top-40 size-[28rem] rounded-full bg-accent-strong/25 blur-[120px] animate-float light:bg-glow/30" />
      <div className="absolute -right-32 top-1/3 size-[32rem] rounded-full bg-glow/15 blur-[140px] animate-float-slow light:bg-accent-soft/15" />
      <div className="absolute bottom-0 left-1/3 size-[22rem] rounded-full bg-accent-strong/10 blur-[120px] animate-float light:bg-glow/20" />
      <div
        className="absolute inset-0 opacity-[0.04] light:opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-tint) 1px, transparent 1px), linear-gradient(to bottom, var(--color-tint) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at top, black 20%, transparent 70%)",
        }}
      />
    </div>
  );
}
