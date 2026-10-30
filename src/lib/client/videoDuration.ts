/**
 * Chrome and Firefox write MediaRecorder WebM files without a duration header, so a freshly recorded
 * take reports `duration === Infinity` until the browser has scanned to its end. Seeking far past the
 * end makes it work the real length out; then we seek back to the start.
 */
export function resolveVideoDuration(video: HTMLVideoElement, timeoutMs = 5000): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return Promise.resolve(video.duration);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener("durationchange", check);
      video.removeEventListener("timeupdate", check);
      video.removeEventListener("seeked", check);
      const d = video.duration;
      try {
        video.currentTime = 0;
      } catch {
        // ignore: a video that can't seek just keeps its position
      }
      resolve(d);
    };
    const check = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    video.addEventListener("durationchange", check);
    video.addEventListener("timeupdate", check);
    video.addEventListener("seeked", check);
    try {
      video.currentTime = 1e7;
    } catch {
      finish();
    }
  });
}
