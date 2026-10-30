/**
 * Denser frames for short and mid-length takes (richer findings, item 5). Pure logic, no DOM, no network.
 *
 * Today a take is sampled once every 2 s (pickFrameTimes): a 33 s clip sends 17 frames. Here a take of up
 * to DENSE.maxDurationSec gets one frame per ~1.25 s window (planSampleWindows, written for this and unused
 * until now): the window's middle candidate is the tick, and its other candidates are the seek times tried
 * when the tick looks soft. Then, where the picture changes fast between two neighbouring ticks (a pan
 * into a new area), one extra frame is taken halfway between them, so each area gets more than one angle.
 *
 * Caps, so the request never outgrows what it has today:
 * - the 48-frame request cap (MAX_PLAN_FRAMES on the server) and DENSE.maxFrames, extra frames included;
 * - the byte budget: every frame keeps at least DENSE.minFrameBytes, or the take falls back to the 2 s ticks;
 * - longer takes keep the 2 s ticks unchanged.
 * SAM holds itself at 300 calls per plan (planSegmentFrames), so more frames can't run past that cap.
 */
import { planSampleWindows } from "./frameSampling";
import { histDistance, type FrameSignature } from "./zones";

export const DENSE = {
  /** Window length for dense takes. */
  intervalSec: 1.25,
  /** Longer takes keep one frame every 2 s. */
  maxDurationSec: 45,
  /** Most frames a dense take sends, scene-change frames included. */
  maxFrames: 30,
  /** Most scene-change frames added. */
  sceneFrames: 4,
  /** Smallest share of the byte budget a frame may get (about q0.55 at 1024 px). */
  minFrameBytes: 80 * 1024,
  /** Colour jump between neighbouring ticks that counts as a fast change (zones.ts cuts at 0.25). */
  sceneThreshold: 0.25,
  /** Seek candidates per window (the middle one is the tick). */
  candidatesPerWindow: 3,
} as const;

/** Request-wide frame cap (the server's MAX_PLAN_FRAMES). */
export const REQUEST_FRAME_CAP = 48;

export interface DensePlan {
  /** Tick times in order. */
  times: number[];
  /** Seek times to try per tick when it looks soft, tick first. Same length as times. */
  candidates: number[][];
  /** Room left for scene-change frames. */
  sceneSlots: number;
}

/**
 * The dense tick plan, or null to keep the 2 s ticks: the take is too long, too short to gain anything,
 * or the byte budget can't give every frame DENSE.minFrameBytes.
 * `legacyCount` is how many frames the 2 s ticks would send; dense is only used when it sends more.
 */
export function planDenseTicks(durationSec: number, opts: { frameBudgetBytes: number; legacyCount: number; maxFrames?: number }): DensePlan | null {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > DENSE.maxDurationSec) return null;
  const byBytes = Math.floor(Math.max(0, opts.frameBudgetBytes) / DENSE.minFrameBytes);
  const cap = Math.min(opts.maxFrames ?? DENSE.maxFrames, DENSE.maxFrames, REQUEST_FRAME_CAP, byBytes);
  if (cap <= opts.legacyCount) return null;
  // Leave room for scene frames only when ticks alone don't already fill the cap.
  const windows = planSampleWindows(durationSec, cap, DENSE.intervalSec, DENSE.candidatesPerWindow);
  if (windows.length <= opts.legacyCount) return null;
  const tickCap = Math.max(opts.legacyCount + 1, cap - DENSE.sceneFrames);
  const ws = windows.length > tickCap ? planSampleWindows(durationSec, tickCap, DENSE.intervalSec, DENSE.candidatesPerWindow) : windows;
  const times: number[] = [];
  const candidates: number[][] = [];
  for (const w of ws) {
    const mid = w.candidates[Math.floor(w.candidates.length / 2)];
    times.push(mid);
    candidates.push([mid, ...w.candidates.filter((c) => c !== mid)]);
  }
  return { times, candidates, sceneSlots: Math.max(0, Math.min(DENSE.sceneFrames, cap - times.length)) };
}

/**
 * Extra seek times where the picture changes fast: halfway between neighbouring ticks whose colour
 * distance passes the threshold, biggest changes first, at most `max`, returned in time order.
 * Signatures that are missing (pixels unreadable) add nothing.
 */
export function sceneChangeTimes(
  times: number[],
  signatures: (FrameSignature | null)[],
  max: number = DENSE.sceneFrames,
  threshold: number = DENSE.sceneThreshold,
): number[] {
  if (max < 1 || times.length < 2 || signatures.length !== times.length) return [];
  const jumps: { t: number; d: number }[] = [];
  for (let i = 1; i < times.length; i++) {
    const a = signatures[i - 1];
    const b = signatures[i];
    if (!a || !b) continue;
    const d = histDistance(a.hist, b.hist);
    const t = Math.round(((times[i - 1] + times[i]) / 2) * 100) / 100;
    if (d >= threshold && t > times[i - 1] && t < times[i]) jumps.push({ t, d });
  }
  return jumps
    .sort((x, y) => y.d - x.d)
    .slice(0, max)
    .map((j) => j.t)
    .sort((x, y) => x - y);
}

/** Merges two time-ordered lists of items by tSec (stable: earlier list first on a tie). */
export function mergeByTime<T extends { tSec: number }>(a: T[], b: T[]): T[] {
  return [...a, ...b].map((v, i) => ({ v, i })).sort((x, y) => x.v.tSec - y.v.tSec || x.i - y.i).map((x) => x.v);
}
