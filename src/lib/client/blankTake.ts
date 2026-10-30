/**
 * Blank take check: a walkthrough whose every frame is one flat colour (lens covered, phone in a
 * pocket, a black picture from a decoder that only gave sound) has nothing for the model to see.
 * Catching it on the device stops a real run from uploading and paying for a plan of nothing.
 * Pure logic, no DOM, no network.
 */

/** Side of the square copy each frame is measured on. Small: this is a cheap per-frame check. */
export const BLANK_SIDE = 32;

/** Below this spread of brightness (0-255 grey) a frame is one flat colour. */
export const BLANK_SPREAD = 4;

/** Below this average brightness a frame is too dark to show anything, whatever its noise. */
export const BLANK_DARK = 8;

export interface LumaStats {
  /** Average grey level, 0-255. */
  mean: number;
  /** Standard deviation of the grey level, 0-255. */
  spread: number;
}

/** Average and spread of the grey level of an RGBA buffer. Null when the buffer is too short. */
export function lumaStats(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): LumaStats | null {
  const n = width * height;
  if (!(n > 0) || rgba.length < n * 4) return null;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const g = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
    sum += g;
    sumSq += g * g;
  }
  const mean = sum / n;
  return { mean, spread: Math.sqrt(Math.max(0, sumSq / n - mean * mean)) };
}

/** True when a frame shows nothing: one flat colour, or near black. */
export function isBlankFrame(s: LumaStats): boolean {
  return s.spread < BLANK_SPREAD || s.mean < BLANK_DARK;
}

/**
 * True only when every frame that could be measured is blank. One real frame is enough to go
 * ahead (a take that starts with the lens covered is still a take), and when no frame could be
 * measured (pixels can't be read back) the take is let through rather than guessed at.
 */
export function isBlankTake(stats: (LumaStats | null)[]): boolean {
  const measured = stats.filter((s): s is LumaStats => s !== null);
  return measured.length > 0 && measured.every(isBlankFrame);
}

export const BLANK_TAKE_MESSAGE =
  "Every frame of this video came out blank or black, so there's nothing to plan from. Check the lens isn't covered and the lights are on, then film it again.";
