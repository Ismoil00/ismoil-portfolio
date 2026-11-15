"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LuAward, LuExpand } from "react-icons/lu";
import type { MediaItem } from "@/types/content";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";
import { Lightbox } from "@/components/media/Lightbox";

/**
 * The certificate's first photo on a card: cropped to the card's fixed height (centered), and
 * opened full size on click — with every photo of it — so the whole document can be read.
 * No photo → a placeholder.
 */
export function CertificateThumb({ images, title }: { images: MediaItem[]; title: string }) {
  const t = useTranslations("certificates");
  const [index, setIndex] = useState<number | null>(null);
  const image = images[0];

  if (!image) return <CoverPlaceholder icon={LuAward} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setIndex(0)}
        aria-label={t("openImage", { name: title })}
        className="zoomable group/thumb relative block size-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover object-center transition-transform duration-500 group-hover/thumb:scale-[1.03]"
        />
        <span className="pointer-events-none absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover/thumb:opacity-100 group-focus-visible/thumb:opacity-100">
          <LuExpand className="size-4" aria-hidden />
        </span>
      </button>
      {index !== null && (
        <Lightbox
          media={images.map((m) => ({ ...m, alt: title }))}
          index={index}
          title={title}
          onIndex={setIndex}
          onClose={() => setIndex(null)}
        />
      )}
    </>
  );
}
