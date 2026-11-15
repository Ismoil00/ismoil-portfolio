"use client";

import { useRef, useState } from "react";
import { LuImagePlus, LuPlay, LuTrash2, LuVideo } from "react-icons/lu";
import { checkFile, discardMedia, uploadMedia, uploadRules, type MediaPurpose } from "@/api/media.api";
import { errorMessage } from "@/api/errors";
import { Button } from "@/components/ui/Button";
import { probeVideo } from "@/lib/video";
import type { Media } from "@/types/api";

/** One photo OR one video (a testimonial's thumbnail). Picking a new one replaces the old. */
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
        <div className="relative grid aspect-video w-40 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-tint/[0.03]">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file */}
          {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <span className="text-xs text-faint">None</span>}
          {isVideo && <span className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-bg/80"><LuPlay className="size-3.5" /></span>}
        </div>
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
      <p className={`mt-1.5 text-xs ${error ? "text-danger" : "text-faint"}`}>
        {error ?? `${uploadRules[imagePurpose].label} · ${uploadRules[videoPurpose].label}`}
      </p>
    </div>
  );
}
