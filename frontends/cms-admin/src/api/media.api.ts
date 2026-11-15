import type { Media } from "@/types/api";
import { api } from "./client";

/** Kinds of upload; each has its own allowed types and size limit on the backend. */
export type MediaPurpose =
  | "resume"
  | "project_image"
  | "project_video"
  | "testimonial_image"
  | "testimonial_video"
  | "certificate_image"
  | "logo";

const MB = 1024 * 1024;

/** The backend's limits, checked before uploading so you don't wait for a refusal. */
export const uploadRules: Record<MediaPurpose, { accept: string; maxBytes: number; label: string }> = {
  resume: { accept: "application/pdf,.pdf", maxBytes: 10 * MB, label: "PDF, up to 10 MB" },
  project_image: { accept: "image/jpeg,image/png,image/webp,image/gif,image/avif", maxBytes: 10 * MB, label: "JPEG, PNG, WebP, GIF or AVIF, up to 10 MB" },
  project_video: { accept: "video/mp4,video/webm,video/quicktime", maxBytes: 100 * MB, label: "MP4, WebM or MOV, up to 100 MB" },
  testimonial_image: { accept: "image/jpeg,image/png,image/webp,image/gif,image/avif", maxBytes: 10 * MB, label: "JPEG, PNG, WebP, GIF or AVIF, up to 10 MB" },
  testimonial_video: { accept: "video/mp4,video/webm,video/quicktime", maxBytes: 100 * MB, label: "MP4, WebM or MOV, up to 100 MB" },
  certificate_image: { accept: "image/jpeg,image/png,image/webp,image/gif,image/avif", maxBytes: 2 * MB, label: "JPEG, PNG, WebP, GIF or AVIF, up to 2 MB" },
  logo: { accept: "image/svg+xml,image/png,image/webp,image/jpeg,.svg", maxBytes: 1 * MB, label: "SVG, PNG, WebP or JPEG, up to 1 MB (transparent background works best)" },
};

/** Problem with a file before uploading it, or null when it's fine. */
export function checkFile(file: File, purpose: MediaPurpose): string | null {
  const rule = uploadRules[purpose];
  if (file.size > rule.maxBytes) return `“${file.name}” is larger than ${rule.maxBytes / MB} MB.`;
  return null;
}

export async function uploadMedia(
  file: File,
  purpose: MediaPurpose,
  options: { poster?: Blob | null; width?: number; height?: number; onProgress?: (fraction: number) => void } = {},
): Promise<Media> {
  const body = new FormData();
  body.append("purpose", purpose);
  body.append("file", file);
  if (options.poster) body.append("poster", options.poster, "poster.jpg");
  if (options.width) body.append("width", String(options.width));
  if (options.height) body.append("height", String(options.height));
  const { data } = await api.post<Media>("/admin/media", body, {
    onUploadProgress: (e) => e.total && options.onProgress?.(e.loaded / e.total),
  });
  return data;
}

/** An upload that won't be saved after all (best effort; the backend also cleans up after a day). */
export async function discardMedia(id: string): Promise<void> {
  await api.delete(`/admin/media/${id}`).catch(() => undefined);
}
