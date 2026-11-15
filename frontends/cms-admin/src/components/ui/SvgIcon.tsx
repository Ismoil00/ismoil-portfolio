/**
 * Draws an SVG stored as text (selector icons) in a single color, through a CSS mask — the same way
 * the public site shows them. The SVG is never inserted into the page as markup.
 */
export function SvgIcon({
  svg,
  color,
  className = "size-5",
  title,
}: {
  svg: string;
  color?: string | null;
  className?: string;
  title?: string;
}) {
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`svg-mask shrink-0 ${className}`}
      style={{ ["--svg" as string]: url, ...(color ? { color } : {}) }}
    />
  );
}
