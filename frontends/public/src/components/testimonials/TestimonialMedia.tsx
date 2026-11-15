"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LuExpand, LuMessageSquareQuote, LuPlay } from "react-icons/lu";
import type { MediaItem } from "@/types/content";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";
import { Lightbox } from "@/components/media/Lightbox";

/**
 * Top of a testimonial card: the author's photo OR their video (never both).
 * Photo → opens full size on click. Video → shows its first frame (or poster) with a play
 * button, and plays full screen with sound and controls on click. Nothing → a placeholder.
 */
export function TestimonialMedia({ media, author }: { media: MediaItem | null; author: string }) {
  const t = useTranslations("testimonials");
  const [open, setOpen] = useState(false);

  if (!media) return <CoverPlaceholder icon={LuMessageSquareQuote} />;

  const isVideo = media.type === "video";
  const still = isVideo ? media.poster : media.src;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={isVideo ? t("playVideo", { name: author }) : t("openPhoto", { name: author })}
        className={`group/media relative block size-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
          isVideo ? "" : "zoomable"
        }`}
      >
        {still ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={still}
            alt=""
            loading="lazy"
            decoding="async"
            // Faces sit in the upper part of a photo: keep that part when cropping.
            className="size-full object-cover object-[center_30%] transition-transform duration-500 group-hover/media:scale-[1.03]"
          />
        ) : (
          <video src={media.src} muted playsInline preload="metadata" className="pointer-events-none size-full object-cover" />
        )}

        {isVideo ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors duration-300 group-hover/media:bg-black/35">
            <span className="inline-flex size-14 items-center justify-center rounded-full border border-white/30 bg-black/45 backdrop-blur transition-transform duration-300 group-hover/media:scale-110">
              <LuPlay className="ml-0.5 size-6 fill-white text-white" aria-hidden />
            </span>
          </span>
        ) : (
          <span className="pointer-events-none absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover/media:opacity-100 group-focus-visible/media:opacity-100">
            <LuExpand className="size-4" aria-hidden />
          </span>
        )}
      </button>

      {open && (
        <Lightbox
          media={[{ ...media, alt: media.alt ?? author }]}
          index={0}
          title={author}
          onIndex={() => {}}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
