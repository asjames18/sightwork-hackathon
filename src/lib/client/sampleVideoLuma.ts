/**
 * Measures the brightness of a few frames of a picked video on the device (browser only), for the
 * light check on the upload screen (see lightCheck.ts). Uses its own hidden video element so the
 * preview the user is watching is never seeked. Best effort: any failure or a slow decoder gives
 * null for that frame, and the whole pass gives up after a time limit.
 */
import { BLANK_SIDE, lumaStats, type LumaStats } from "./blankTake";
import { lightSampleTimes } from "./lightCheck";

/** Whole pass gives up after this long; the warning is a nicety, never a wait. */
const PASS_LIMIT_MS = 8000;
const SEEK_LIMIT_MS = 2500;

function waitFor(video: HTMLVideoElement, event: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
      resolve(ok);
    };
    const onEvent = () => done(true);
    const onError = () => done(false);
    const timer = setTimeout(() => done(false), ms);
    video.addEventListener(event, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

/** Brightness of LIGHT_SAMPLES frames of the video at `url`. Empty when it can't be read at all. */
export async function sampleVideoLuma(url: string, durationSec: number, signal?: AbortSignal): Promise<(LumaStats | null)[]> {
  const times = lightSampleTimes(durationSec);
  if (times.length === 0 || typeof document === "undefined") return [];
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  const started = Date.now();
  const out: (LumaStats | null)[] = [];
  try {
    if (video.readyState < 1 && !(await waitFor(video, "loadeddata", SEEK_LIMIT_MS))) return [];
    const canvas = document.createElement("canvas");
    canvas.width = BLANK_SIDE;
    canvas.height = BLANK_SIDE;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    if (!g) return [];
    for (const t of times) {
      if (signal?.aborted || Date.now() - started > PASS_LIMIT_MS) break;
      video.currentTime = Math.min(t, Math.max(0, (video.duration || durationSec) - 0.05));
      if (!(await waitFor(video, "seeked", SEEK_LIMIT_MS))) {
        out.push(null);
        continue;
      }
      try {
        g.drawImage(video, 0, 0, BLANK_SIDE, BLANK_SIDE);
        out.push(lumaStats(g.getImageData(0, 0, BLANK_SIDE, BLANK_SIDE).data, BLANK_SIDE, BLANK_SIDE));
      } catch {
        out.push(null);
      }
    }
    return out;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}
