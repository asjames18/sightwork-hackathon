/**
 * A one-time hint for the before/after slider: when the comparison first comes into view, the divider
 * glides a little toward the before side, back across to the after side, and settles in the middle,
 * so it's clear the picture can be dragged. It never runs with reduced motion and stops at any touch.
 */

/** How long the whole hint takes, in milliseconds. */
export const SWEEP_MS = 2200;
/** How far either side of the middle the divider travels, in percent. */
export const SWEEP_REACH = 25;
/** Wait after the slider comes into view before the hint starts, in milliseconds. */
export const SWEEP_DELAY_MS = 500;
/** How much of the slider must be on screen before the hint starts (0 to 1). */
export const SWEEP_VISIBLE = 0.6;

/**
 * Slider value at `elapsedMs` into the hint: 50, out to 50 + reach, across to 50 - reach, back to 50,
 * following one smooth sine wave. Before the start or after the end it is the middle.
 */
export function sweepPos(elapsedMs: number, durationMs = SWEEP_MS, reach = SWEEP_REACH): number {
  if (!Number.isFinite(elapsedMs) || !(durationMs > 0) || elapsedMs <= 0 || elapsedMs >= durationMs) return 50;
  const r = Math.min(50, Math.max(0, reach));
  return Math.round(50 + r * Math.sin((2 * Math.PI * elapsedMs) / durationMs));
}

/** True once the hint has run its course. */
export function sweepDone(elapsedMs: number, durationMs = SWEEP_MS): boolean {
  return elapsedMs >= durationMs;
}

/** Whether the hint should play at all: only once, never with reduced motion, never after a touch. */
export function shouldSweep(opts: { reducedMotion: boolean; alreadyPlayed: boolean; touched: boolean }): boolean {
  return !opts.reducedMotion && !opts.alreadyPlayed && !opts.touched;
}
