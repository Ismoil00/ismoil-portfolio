"use client";

import { useRef, useState } from "react";
import { LuExpand, LuImagePlus, LuPlay, LuTrash2, LuVideo } from "react-icons/lu";
import { checkFile, discardMedia, uploadMedia, uploadRules, type MediaPurpose } from "@/api/media.api";
import { errorMessage } from "@/api/errors";
import { Button } from "@/components/ui/Button";
import { MediaViewer } from "@/components/ui/MediaViewer";
import { probeVideo } from "@/lib/video";
import type { Media } from "@/types/api";

/**
 * One photo OR one video (a testimonial's thumbnail). Picking a new one replaces the old.
 * A click on the thumbnail opens it full size (a video plays) to check it before saving.
 */
export function SingleMediaField({
  value,
  onChange,
  imagePurpose,
  videoPurpose,
}: {
  value: Media | null;
  onChange: (media: Media | null) => void;
  imagePurpose: MediaPurpose;
  videoPurpose: MediaPurpose;
}) {
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);

  async function upload(file: File | undefined, kind: "image" | "video") {
    if (!file) return;
    const purpose = kind === "image" ? imagePurpose : videoPurpose;
    const problem = checkFile(file, purpose);
    if (problem) return setError(problem);
    setError(null);
    setProgress(0);
    try {
      const extra = kind === "video" ? await probeVideo(file).catch(() => ({ poster: null })) : {};
      const media = await uploadMedia(file, purpose, { ...extra, onProgress: setProgress });
      if (value) void discardMedia(value.id);
      onChange(media);
    } catch (err) {
      setError(errorMessage(err, "Couldn't upload the file."));
    } finally {
      setProgress(null);
    }
  }

  const isVideo = value?.content_type.startsWith("video/");
  const preview = isVideo ? value?.poster_url : value?.url;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        {value ? (
          <button
            type="button"
            onClick={() => setViewing(true)}
            aria-label={`${isVideo ? "Play" : "Open"} ${value.original_name} full size`}
            className="group/open relative grid aspect-video w-40 shrink-0 cursor-zoom-in place-items-center overflow-hidden rounded-xl border border-line-strong bg-tint/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded file
              <img src={preview} alt="" className="size-full object-cover" />
            ) : (
              <video src={value.url} muted preload="metadata" className="pointer-events-none size-full object-cover" />
            )}
            {isVideo ? (
              <span className="absolute inset-0 grid place-items-center bg-black/20 transition-colors group-hover/open:bg-black/35">
                <span className="grid size-9 place-items-center rounded-full border border-white/30 bg-black/50 text-white backdrop-blur transition-transform group-hover/open:scale-110">
                  <LuPlay className="ml-0.5 size-4 fill-current" />
                </span>
              </span>
            ) : (
              <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover/open:opacity-100 group-focus-visible/open:opacity-100">
                <LuExpand className="size-3.5" />
              </span>
            )}
          </button>
        ) : (
          <div className="grid aspect-video w-40 shrink-0 place-items-center rounded-xl border border-dashed border-line-strong bg-tint/[0.03]">
            <span className="text-xs text-faint">None</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={progress !== null} icon={<LuImagePlus className="size-3.5" />} onClick={() => imageInput.current?.click()}>
            {progress !== null ? `${Math.round(progress * 100)}%` : "Photo"}
          </Button>
          <Button size="sm" variant="secondary" disabled={progress !== null} icon={<LuVideo className="size-3.5" />} onClick={() => videoInput.current?.click()}>
            Video
          </Button>
          {value && (
            <Button size="sm" variant="ghost" icon={<LuTrash2 className="size-3.5" />} onClick={() => { void discardMedia(value.id); onChange(null); }}>
              Remove
            </Button>
          )}
        </div>
        <input ref={imageInput} type="file" accept={uploadRules[imagePurpose].accept} hidden onChange={(e) => { void upload(e.target.files?.[0], "image"); e.target.value = ""; }} />
        <input ref={videoInput} type="file" accept={uploadRules[videoPurpose].accept} hidden onChange={(e) => { void upload(e.target.files?.[0], "video"); e.target.value = ""; }} />
      </div>
      {viewing && value && <MediaViewer items={[value]} index={0} onIndex={() => {}} onClose={() => setViewing(false)} />}
      <p className={`mt-1.5 text-xs ${error ? "text-danger" : "text-faint"}`}>
        {error ?? `${uploadRules[imagePurpose].label} · ${uploadRules[videoPurpose].label}`}
      </p>
    </div>
  );
}
