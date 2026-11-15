/**
 * Reads a video file in the browser: its size and a still frame for the poster (shown before the
 * video plays). Done here because the server has no video tools.
 */
export async function probeVideo(file: File): Promise<{ width: number; height: number; poster: Blob | null }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("This video can't be read by the browser."));
    });
    const width = video.videoWidth;
    const height = video.videoHeight;
    // A frame a little into the video (the very first one is often black).
    const target = Math.min(1, (video.duration || 0) * 0.1);
    if (target > 0) {
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        video.currentTime = target;
      });
    }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1920 / Math.max(width, height, 1));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return { width, height, poster };
  } finally {
    URL.revokeObjectURL(url);
  }
}
