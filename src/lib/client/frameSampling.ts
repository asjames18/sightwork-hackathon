/**
 * Proposal C prep (longer takes), client side: time-based sampling that keeps the sharpest frame
 * in each window instead of whatever frame sits exactly on the tick.
 *
 * The window sampling (planSampleWindows) is NOT WIRED YET; only sharpness and pickSharpest are
 * used, through sharpTick.ts, to nudge soft ticks. buildPlanRequest still samples with pickFrameTimes, and duration.ts keeps its
 * 95 s warning / 150 s block. As agreed on Oct 29, the window sampling and
 * threshold changes only switch on after C's server steps 1-4 ship (48 frames to Spark on Meta,
 * Blob upload, staged pipeline under the 300 s limit). Pure logic, no DOM, no network.
 */

export interface SampleWindow {
  /** Window start and end in seconds. */
  startSec: number;
  endSec: number;
  /** Candidate seek times inside the window, in order; the sharpest one is kept. */
  candidates: number[];
}

/**
 * Splits the take into windows of about windowSec (spread evenly when that would pass maxFrames),
 * each with up to candidatesPerWindow evenly spaced seek times. Stays 0.25 s off both ends like
 * pickFrameTimes so seeks land on decodable frames.
 */
export function planSampleWindows(durationSec: number, maxFrames = 48, windowSec = 2.5, candidatesPerWindow = 3): SampleWindow[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || maxFrames < 1 || candidatesPerWindow < 1) return [];
  const start = Math.min(0.25, durationSec / 2);
  const end = Math.max(start, durationSec - 0.25);
  const span = end - start;
  const n = Math.max(1, Math.min(maxFrames, Math.ceil(span / Math.max(windowSec, 0.1))));
  const width = span / n;
  return Array.from({ length: n }, (_, i) => {
    const ws = start + width * i;
    const we = i === n - 1 ? end : ws + width;
    const k = width > 0 ? candidatesPerWindow : 1;
    const candidates = Array.from({ length: k }, (_, j) => round2(ws + ((we - ws) * (j + 0.5)) / k));
    return { startSec: round2(ws), endSec: round2(we), candidates };
  });
}

/**
 * Sharpness as the variance of a 4-neighbour Laplacian over the grey image (RGBA in). Higher is
 * sharper; motion blur and out-of-focus frames score low. Edges of the image are skipped.
 */
export function sharpness(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): number {
  if (width < 3 || height < 3 || rgba.length < width * height * 4) return 0;
  const grey = new Float32Array(width * height);
  for (let i = 0; i < grey.length; i++) grey[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = grey[i - 1] + grey[i + 1] + grey[i - width] + grey[i + width] - 4 * grey[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Index of the highest score (the first on a tie); -1 when empty. */
export function pickSharpest(scores: number[]): number {
  let best = -1;
  for (let i = 0; i < scores.length; i++) if (Number.isFinite(scores[i]) && (best < 0 || scores[i] > scores[best])) best = i;
  return best;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
