"use client";

import { useState } from "react";
import { LuExpand, LuPlay } from "react-icons/lu";
import type { MediaItem } from "@/types/content";
import { Lightbox } from "@/components/media/Lightbox";

/**
 * The one control on a project card's cover that opens the cover itself instead of the project
 * page: a play button in the middle of a video cover, or an expand button in the corner of an
 * image cover. Only the button opens the viewer; the rest of the cover, like the rest of the card,
 * still opens the project page (the button sits above the card's stretched link).
 * The expand button shows on hover with a mouse and stays visible on touch screens.
 */
export function ProjectCoverButton({ cover, title, label }: { cover: MediaItem; title: string; label: string }) {
  const [open, setOpen] = useState(false);
  const video = cover.type === "video";

  return (
    <>
      {video ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          title={label}
          className="absolute left-1/2 top-1/2 z-10 inline-flex size-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-black/45 backdrop-blur transition-[scale,background-color] duration-300 hover:scale-110 hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <LuPlay className="ml-0.5 size-6 fill-white text-white" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          title={label}
          className="absolute right-3 top-3 z-10 inline-flex size-9 cursor-zoom-in items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-[opacity,scale,background-color] duration-300 group-hover/card:opacity-100 hover:scale-110 hover:bg-black/70 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent pointer-coarse:opacity-100"
        >
          <LuExpand className="size-4" aria-hidden />
        </button>
      )}

      {open && (
        <Lightbox media={[{ ...cover, alt: cover.alt ?? title }]} index={0} title={title} onIndex={() => {}} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
