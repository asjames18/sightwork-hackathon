/**
 * Live camera hints while recording: a small copy of the preview is checked on the device about twice a
 * second, and the person filming gets a gentle line when the picture stays too dark or keeps blurring
 * (a fast pan). They can fix it mid-walk instead of finding out after the run. Pure logic, no DOM, no network.
 */
import { DIM_MEAN } from "./lightCheck";

/** How often the preview is measured, in ms. */
export const HINT_SAMPLE_MS = 500;

/** Longest side, in px, of the small copy that is measured. Small on purpose: this runs while recording. */
export const HINT_SIDE = 120;

/** Below this average grey level (0-255) a sample counts as dark (same line as the upload screen's check). */
export const LIVE_DIM_MEAN = DIM_MEAN;

/** Seconds a dark picture must last before the hint shows (a quick pass through a doorway says nothing). */
export const DARK_HINT_SEC = 3;

/** A sample counts as blurred when its sharpness is under this share of the take's typical sharpness. */
export const BLUR_RATIO = 0.35;

/** Seconds of steady blur before the hint shows (one quick turn is fine). */
export const BLUR_HINT_SEC = 1.5;

/** Recent bright samples kept to learn what "sharp" looks like for this camera and room. */
export const SHARP_HISTORY = 24;

/** Bright samples needed before blur is judged at all. */
export const SHARP_MIN_HISTORY = 4;

/** Once shown, a hint stays up at least this long, so it doesn't flicker on a borderline picture. */
export const HINT_HOLD_SEC = 2;

export type LiveHint = "dark" | "blur";

export interface LiveSample {
  /** Average grey level, 0-255. */
  mean: number;
  /** Laplacian variance of the same small copy (frameSampling.sharpness). */
  sharp: number;
}

export interface LiveHintState {
  sharpHistory: number[];
  darkSince: number | null;
  blurSince: number | null;
  shown: LiveHint | null;
  shownAt: number | null;
}

export const INITIAL_LIVE_HINT_STATE: LiveHintState = {
  sharpHistory: [],
  darkSince: null,
  blurSince: null,
  shown: null,
  shownAt: null,
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Size of the small copy for a preview of width x height: longest side HINT_SIDE, never upscaled. */
export function hintCanvasSize(width: number, height: number): { width: number; height: number } | null {
  if (!(width > 0 && height > 0)) return null;
  const scale = Math.min(1, HINT_SIDE / Math.max(width, height));
  return { width: Math.max(3, Math.round(width * scale)), height: Math.max(3, Math.round(height * scale)) };
}

/** Which condition the latest readings point to right now, before the hold. Dark wins over blur. */
function rawHint(s: LiveHintState, nowSec: number): LiveHint | null {
  if (s.darkSince !== null && nowSec - s.darkSince >= DARK_HINT_SEC) return "dark";
  if (s.blurSince !== null && nowSec - s.blurSince >= BLUR_HINT_SEC) return "blur";
  return null;
}

/**
 * Next state after one sample at nowSec (seconds, any steady clock). A null sample (the preview couldn't be
 * read) changes nothing. Dark samples don't teach "sharp" and aren't judged for blur: a dark picture is
 * always soft, and the dark hint already covers it.
 */
export function nextLiveHintState(state: LiveHintState, sample: LiveSample | null, nowSec: number): LiveHintState {
  if (!sample || !Number.isFinite(sample.mean) || !Number.isFinite(sample.sharp)) return state;
  const dark = sample.mean < LIVE_DIM_MEAN;
  let { sharpHistory, darkSince, blurSince } = state;
  darkSince = dark ? (darkSince ?? nowSec) : null;
  if (dark) {
    blurSince = null;
  } else {
    const blurred = sharpHistory.length >= SHARP_MIN_HISTORY && sample.sharp < median(sharpHistory) * BLUR_RATIO;
    blurSince = blurred ? (blurSince ?? nowSec) : null;
    sharpHistory = [...sharpHistory, sample.sharp].slice(-SHARP_HISTORY);
  }
  const next: LiveHintState = { ...state, sharpHistory, darkSince, blurSince };
  const want = rawHint(next, nowSec);
  if (want) {
    // shownAt is the last time the condition held, so the hold counts from when it cleared.
    next.shown = want;
    next.shownAt = nowSec;
  } else if (state.shown && state.shownAt !== null && nowSec - state.shownAt < HINT_HOLD_SEC) {
    // Keep it up a little longer.
  } else {
    next.shown = null;
    next.shownAt = null;
  }
  return next;
}

export const LIVE_HINT_TEXT: Record<LiveHint, string> = {
  dark: "It's dark here. Turn on a light or point at the lit part of the room, so damage in the shadows shows up.",
  blur: "Slow down a little. The picture is blurring, so pan slowly and pause on anything broken.",
};
