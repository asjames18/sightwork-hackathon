import { pickSharpest, sharpness } from "./frameSampling";

/**
 * Sharper frames at the same ticks: when a frame time from pickFrameTimes looks soft next to the
 * rest of the take, a couple of nearby seek times are tried and the sharpest one is sent. Frame count, spacing and request size stay
 * the same; only a blurred tick (a phone mid-turn) gets swapped for a crisper neighbour.
 * Pure logic, no DOM, no network.
 */

/** Seconds either side of a tick that the nudge may try. */
export const SHARP_SPREAD_SEC = 0.3;

/** A neighbour must beat the tick's own sharpness by this factor to replace it. */
export const SHARP_MARGIN = 1.15;

/**
 * A tick is only nudged when it looks soft next to the take so far: sharpness under this share of
 * the median of the earlier ticks. Steady ticks cost one seek, as before.
 */
export const SOFT_RATIO = 0.6;

/** Earlier ticks needed before the median means anything; until then every tick is nudged. */
export const SOFT_MIN_HISTORY = 3;

/** Longest side, in px, of the small grey copy sharpness is measured on. */
export const SCORE_SIDE = 160;

/**
 * Seek times to try for one tick: the tick itself first, then t - spread and t + spread, kept
 * inside the take (0.25 s off both ends, like pickFrameTimes) and without duplicates.
 */
export function tickCandidates(t: number, durationSec: number, spreadSec = SHARP_SPREAD_SEC): number[] {
  if (!Number.isFinite(t)) return [];
  if (!Number.isFinite(durationSec) || durationSec <= 0 || !(spreadSec > 0)) return [round2(t)];
  const lo = Math.min(0.25, durationSec / 2);
  const hi = Math.max(lo, durationSec - 0.25);
  const out: number[] = [round2(t)];
  for (const c of [t - spreadSec, t + spreadSec]) {
    const v = round2(Math.min(hi, Math.max(lo, c)));
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Which candidate to keep. scores[0] is the tick itself and wins unless a neighbour is at least
 * `margin` times sharper, so a steady shot keeps its exact time. When the tick can't be scored,
 * the sharpest scored neighbour is kept; when nothing can be scored, the tick.
 */
export function chooseSharpTick(scores: number[], margin = SHARP_MARGIN): number {
  if (scores.length === 0) return -1;
  const best = pickSharpest(scores);
  if (best < 0) return 0;
  const own = scores[0];
  if (!Number.isFinite(own)) return best;
  return best !== 0 && scores[best] > own * margin ? best : 0;
}

/**
 * Whether a tick should try its neighbours: when it can't be scored, when there are too few
 * earlier ticks to compare with, or when it's under SOFT_RATIO of their median sharpness.
 */
export function isSoftTick(score: number, history: number[], ratio = SOFT_RATIO): boolean {
  if (!Number.isFinite(score)) return true;
  const seen = history.filter(Number.isFinite).sort((a, b) => a - b);
  if (seen.length < SOFT_MIN_HISTORY) return true;
  const mid = seen.length / 2;
  const median = seen.length % 2 ? seen[Math.floor(mid)] : (seen[mid - 1] + seen[mid]) / 2;
  return score < median * ratio;
}

/** Score size for a frame: longest side SCORE_SIDE, never upscaled. */
export function scoreSize(w: number, h: number): { w: number; h: number } {
  const scale = Math.min(1, SCORE_SIDE / Math.max(w, h, 1));
  return { w: Math.max(3, Math.round(w * scale)), h: Math.max(3, Math.round(h * scale)) };
}

/** Sharpness of an RGBA buffer, re-exported so callers only need this module. */
export function frameSharpness(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): number {
  return sharpness(rgba, width, height);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
