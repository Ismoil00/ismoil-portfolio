import type { IconRef, MediaItem } from "@/types/content";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";

/**
 * A project's thumbnail, filling its box (`object-cover`, centered: same height on every card,
 * nothing stretched). A video cover shows its poster (or, without one, its first frame). Without
 * any image, a branded placeholder with the product-type icon is drawn instead.
 */
export function ProjectCover({ cover, types }: { cover: MediaItem | null; types: IconRef[] }) {
  const src = cover ? (cover.type === "video" ? cover.poster : cover.src) : undefined;

  if (!src && cover?.type === "video") {
    return <video src={cover.src} muted playsInline preload="metadata" className="pointer-events-none size-full object-cover object-center" />;
  }

  if (src) {
    return (
      // Images come from the admin panel (any host), so a plain <img> is used.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover object-center" />
    );
  }

  return <CoverPlaceholder icon={types[0]?.icon ?? null} />;
}
