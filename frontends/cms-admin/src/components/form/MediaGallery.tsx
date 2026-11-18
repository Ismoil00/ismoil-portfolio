"use client";

import { useRef, useState } from "react";
import { LuExpand, LuImagePlus, LuPlay, LuStar, LuTrash2, LuVideo } from "react-icons/lu";
import { checkFile, discardMedia, uploadMedia, uploadRules, type MediaPurpose } from "@/api/media.api";
import { errorMessage } from "@/api/errors";
import { Button } from "@/components/ui/Button";
import { MediaViewer } from "@/components/ui/MediaViewer";
import { DragGrip, SortableList } from "@/components/ui/SortableList";
import { probeVideo } from "@/lib/video";
import type { Media } from "@/types/api";

interface Pending {
  id: string;
  name: string;
  progress: number;
}

/**
 * Images (and optionally videos) of a project or certificate: uploaded as soon as they're picked,
 * shown in order (drag to reorder); any file, image or video, can be the cover. Limits are checked
 * before upload. A click on a file opens it full size (videos play) to check it before saving.
 */
export function MediaGallery({
  value,
  onChange,
  imagePurpose,
  videoPurpose,
  maxImages,
  maxVideos = 0,
  coverId,
  onCoverChange,
  disabled,
  disabledText,
  invalid,
}: {
  value: Media[];
  onChange: (media: Media[]) => void;
  imagePurpose: MediaPurpose;
  videoPurpose?: MediaPurpose;
  maxImages: number;
  maxVideos?: number;
  coverId?: string | null;
  onCoverChange?: (id: string | null) => void;
  disabled?: boolean;
  disabledText?: string;
  invalid?: boolean;
}) {
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  // The latest list, for uploads that finish after other changes.
  const latest = useRef(value);
  latest.current = value;

  const images = value.filter((m) => m.content_type.startsWith("image/"));
  const videos = value.filter((m) => m.content_type.startsWith("video/"));
  const pendingVideos = pending.filter((p) => p.name.startsWith("video:")).length;
  const pendingImages = pending.length - pendingVideos;

  async function add(files: FileList | null, kind: "image" | "video") {
    if (!files?.length) return;
    const purpose = kind === "image" ? imagePurpose : videoPurpose!;
    const room = kind === "image" ? maxImages - images.length - pendingImages : maxVideos - videos.length - pendingVideos;
    const problems: string[] = [];
    const picked = [...files];
    if (picked.length > room) problems.push(`Only ${Math.max(0, room)} more ${kind === "image" ? "image(s)" : "video(s)"} can be added.`);
    const accepted = picked.slice(0, Math.max(0, room)).filter((file) => {
      const problem = checkFile(file, purpose);
      if (problem) problems.push(problem);
      return !problem;
    });
    setErrors(problems);

    await Promise.all(
      accepted.map(async (file) => {
        const id = `${kind}:${crypto.randomUUID()}`;
        setPending((list) => [...list, { id, name: `${kind}:${file.name}`, progress: 0 }]);
        const onProgress = (progress: number) => setPending((list) => list.map((p) => (p.id === id ? { ...p, progress } : p)));
        try {
          const extra = kind === "video" ? await probeVideo(file).catch(() => ({ width: undefined, height: undefined, poster: null })) : {};
          const media = await uploadMedia(file, purpose, { ...extra, onProgress });
          const next = [...latest.current, media];
          latest.current = next;
          onChange(next);
          if (kind === "image" && onCoverChange && !coverId && !next.some((m) => m.id === coverId)) {
            // The first image becomes the cover until another one is picked.
            if (next.filter((m) => m.content_type.startsWith("image/")).length === 1) onCoverChange(media.id);
          }
        } catch (error) {
          setErrors((list) => [...list, `${file.name}: ${errorMessage(error, "upload failed")}`]);
        } finally {
          setPending((list) => list.filter((p) => p.id !== id));
        }
      }),
    );
  }

  function remove(media: Media) {
    onChange(value.filter((m) => m.id !== media.id));
    if (coverId === media.id) onCoverChange?.(images.find((m) => m.id !== media.id)?.id ?? null);
    // Files already saved with the record are deleted by the backend on save; brand-new uploads can go now.
    void discardMedia(media.id);
  }

  if (disabled) {
    return <p className="rounded-xl border border-dashed border-line px-5 py-6 text-center text-sm text-subtle">{disabledText}</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" icon={<LuImagePlus className="size-3.5" />} onClick={() => imageInput.current?.click()} disabled={images.length + pendingImages >= maxImages}>
          Add images
        </Button>
        {videoPurpose && maxVideos > 0 && (
          <Button size="sm" variant="secondary" icon={<LuVideo className="size-3.5" />} onClick={() => videoInput.current?.click()} disabled={videos.length + pendingVideos >= maxVideos}>
            Add video
          </Button>
        )}
        <span className="text-xs text-faint">
          {images.length}/{maxImages} images{videoPurpose && maxVideos > 0 ? ` · ${videos.length}/${maxVideos} videos` : ""}
        </span>
        <input ref={imageInput} type="file" accept={uploadRules[imagePurpose].accept} multiple hidden onChange={(e) => { void add(e.target.files, "image"); e.target.value = ""; }} />
        {videoPurpose && (
          <input ref={videoInput} type="file" accept={uploadRules[videoPurpose].accept} hidden onChange={(e) => { void add(e.target.files, "video"); e.target.value = ""; }} />
        )}
      </div>

      {value.length === 0 && pending.length === 0 ? (
        <div data-invalid={invalid || undefined} className="rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-subtle data-[invalid=true]:border-danger/70">
          No files yet. {uploadRules[imagePurpose].label}.
        </div>
      ) : (
        <SortableList
          items={value}
          onReorder={(ids) => onChange(ids.map((id) => value.find((m) => m.id === id)!))}
          layout="grid"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          renderItem={(media, handle) => {
            const isVideo = media.content_type.startsWith("video/");
            const isCover = coverId === media.id;
            const preview = isVideo ? media.poster_url : media.url;
            return (
              <figure className={`group relative overflow-hidden rounded-xl border bg-tint/[0.03] ${isCover ? "border-accent/70" : "border-line"}`}>
                <button
                  type="button"
                  onClick={() => setViewing(value.indexOf(media))}
                  aria-label={`${isVideo ? "Play" : "Open"} ${media.original_name} full size`}
                  className="group/open relative block aspect-video w-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file */}
                  {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-faint"><LuVideo className="size-6" /></span>}
                  {isVideo ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/20 transition-colors group-hover/open:bg-black/35">
                      <span className="grid size-10 place-items-center rounded-full border border-white/30 bg-black/50 text-white backdrop-blur transition-transform group-hover/open:scale-110">
                        <LuPlay className="ml-0.5 size-4 fill-current" />
                      </span>
                    </span>
                  ) : (
                    <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover/open:opacity-100 group-focus-visible/open:opacity-100">
                      <LuExpand className="size-3.5" />
                    </span>
                  )}
                  {isCover && <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-bg light:text-white">Cover</span>}
                </button>
                <figcaption className="flex items-center gap-1 px-1.5 py-1.5">
                  <DragGrip handle={handle} />
                  <span className="min-w-0 flex-1 truncate text-xs text-subtle" title={media.original_name}>{media.original_name}</span>
                  {onCoverChange && (
                    <button type="button" onClick={() => onCoverChange(media.id)} aria-label={`Use ${media.original_name} as cover`} title={isVideo ? "Use as the card's cover (the site plays it from the card)" : "Use as the card's cover"} aria-pressed={isCover} className={`grid size-7 place-items-center rounded-full transition-colors ${isCover ? "text-accent" : "text-faint hover:text-accent"}`}>
                      <LuStar className={`size-3.5 ${isCover ? "fill-current" : ""}`} />
                    </button>
                  )}
                  <button type="button" onClick={() => remove(media)} aria-label={`Remove ${media.original_name}`} title="Remove" className="grid size-7 place-items-center rounded-full text-faint transition-colors hover:bg-danger/10 hover:text-danger">
                    <LuTrash2 className="size-3.5" />
                  </button>
                </figcaption>
              </figure>
            );
          }}
        />
      )}

      {viewing !== null && <MediaViewer items={value} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />}

      {pending.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {pending.map((p) => (
            <li key={p.id} className="flex items-center gap-3 text-xs text-subtle">
              <span className="w-48 truncate">{p.name.slice(p.name.indexOf(":") + 1)}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-tint/10">
                <span className="block h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(p.progress * 100)}%` }} />
              </span>
              <span className="w-10 text-right tabular-nums">{Math.round(p.progress * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
      {errors.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-danger" role="alert">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      <p className="mt-2 text-xs text-faint">
        {uploadRules[imagePurpose].label}
        {videoPurpose && maxVideos > 0 ? ` · ${uploadRules[videoPurpose].label}` : ""}. Drag to reorder.
      </p>
    </div>
  );
}
