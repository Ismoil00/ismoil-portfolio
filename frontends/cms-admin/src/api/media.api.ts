import type { Media } from "@/types/api";
import { api, csrfToken } from "./client";
import { UserFacingError } from "./errors";

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

type UploadOptions = { poster?: Blob | null; width?: number; height?: number; onProgress?: (fraction: number) => void };

/**
 * Kinds of file that may be bigger than one request can carry on Vercel (4.5 MB). With Vercel Blob
 * (NEXT_PUBLIC_DIRECT_UPLOADS=true) they go from the browser straight to Blob; the backend then checks
 * them like any other upload. Everything else, and everything locally, goes through the backend.
 */
const DIRECT_PURPOSES: ReadonlySet<MediaPurpose> = new Set([
  "resume",
  "project_image",
  "project_video",
  "testimonial_image",
  "testimonial_video",
]);
const directUploads = process.env.NEXT_PUBLIC_DIRECT_UPLOADS === "true";

export async function uploadMedia(file: File, purpose: MediaPurpose, options: UploadOptions = {}): Promise<Media> {
  if (directUploads && DIRECT_PURPOSES.has(purpose)) return uploadDirect(file, purpose, options);
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

/** Upload to Vercel Blob (staging path), then let the backend check the file and keep it. */
async function uploadDirect(file: File, purpose: MediaPurpose, options: UploadOptions): Promise<Media> {
  const pathname = `incoming/${purpose}/${crypto.randomUUID().replaceAll("-", "")}`;
  const csrf = csrfToken();
  try {
    const { upload } = await import("@vercel/blob/client"); // loaded only when it's used
    await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/blob/upload",
      headers: csrf ? { "X-CSRF-Token": csrf } : undefined,
      contentType: file.type || "application/octet-stream",
      multipart: file.size > 20 * MB,
      onUploadProgress: ({ percentage }) => options.onProgress?.((percentage / 100) * 0.95),
    });
  } catch {
    throw new UserFacingError(`Couldn't upload “${file.name}”. Check the connection and try again.`);
  }
  const body = new FormData();
  body.append("pathname", pathname);
  body.append("filename", file.name);
  if (options.poster) body.append("poster", options.poster, "poster.jpg");
  if (options.width) body.append("width", String(options.width));
  if (options.height) body.append("height", String(options.height));
  const { data } = await api.post<Media>("/admin/media/direct", body);
  options.onProgress?.(1);
  return data;
}

/** An upload that won't be saved after all (best effort; the backend also cleans up after a day). */
export async function discardMedia(id: string): Promise<void> {
  await api.delete(`/admin/media/${id}`).catch(() => undefined);
}
