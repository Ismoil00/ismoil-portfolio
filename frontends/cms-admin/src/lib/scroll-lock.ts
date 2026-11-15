/**
 * Locks the page scroll while an overlay is open (Other links, image lightbox, phone menu)
 * without anything moving sideways. Hiding the scrollbar makes the page wider, so:
 * - the page gets the scrollbar's width back as padding on <html>;
 * - elements fixed to the screen (the header) don't see that padding, so the width is also
 *   published as `--scrollbar-lock` for them to pad themselves with.
 * Returns the unlock function. Locks can overlap; the page is unlocked by the last one.
 */
let locks = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

export function lockScroll(): () => void {
  const root = document.documentElement;
  if (locks++ === 0) {
    saved = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (scrollbar > 0) {
      root.style.paddingRight = `${scrollbar}px`;
      root.style.setProperty("--scrollbar-lock", `${scrollbar}px`);
    }
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks > 0 || !saved) return;
    root.style.overflow = saved.overflow;
    root.style.paddingRight = saved.paddingRight;
    root.style.removeProperty("--scrollbar-lock");
    saved = null;
  };
}
