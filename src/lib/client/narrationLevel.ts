/**
 * Evens out the narration level before it is sent. A phone held at arm's length in a big room
 * records speech far below full scale, and speech recognition can miss it. Quiet takes get gain,
 * capped so room tone isn't blown up into hiss; takes that are already loud are left alone; and
 * nothing clips. A single click or bump doesn't set the level: it is read from the 99.9th
 * percentile of the sample magnitudes, and anything above that is clamped.
 */

/** Level the loud parts of the take are brought up to (about -3 dBFS). */
export const TARGET_PEAK = 0.7;
/** Most gain a quiet take gets (+24 dB). */
export const MAX_GAIN = 16;

const BINS = 4096;
const PERCENTILE = 0.999;

/** The 99.9th percentile of |sample|, from a histogram (no sort, fine for 90 s at 16 kHz). */
export function referencePeak(samples: Float32Array): number {
  const n = samples.length;
  if (n === 0) return 0;
  const hist = new Uint32Array(BINS);
  for (let i = 0; i < n; i++) {
    const a = Math.min(1, Math.abs(samples[i]));
    hist[Math.min(BINS - 1, Math.floor(a * BINS))]++;
  }
  const above = Math.floor(n * (1 - PERCENTILE));
  let seen = 0;
  for (let b = BINS - 1; b >= 0; b--) {
    seen += hist[b];
    if (seen > above) return b === 0 ? 0 : (b + 1) / BINS; // bin 0 is below -72 dBFS: silence
  }
  return 0;
}

/** Gain for this take: at least 1 (never turned down), at most MAX_GAIN. */
export function narrationGain(samples: Float32Array): number {
  const peak = referencePeak(samples);
  if (!(peak > 0)) return 1;
  return Math.max(1, Math.min(MAX_GAIN, TARGET_PEAK / peak));
}

/** The take with narrationGain applied and clamped to [-1, 1]; the same array when no gain is needed. */
export function normalizeNarration(samples: Float32Array): Float32Array {
  const gain = narrationGain(samples);
  if (gain === 1) return samples;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = Math.max(-1, Math.min(1, samples[i] * gain));
  return out;
}
