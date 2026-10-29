/**
 * Zone grouping for one continuous walkthrough (proposal B, client part).
 *
 * Each sampled frame gets a small signature: a coarse colour histogram (what the area looks like)
 * and a 64-bit difference hash, dHash (its layout). Walking through the take in time order:
 * - a frame that looks like the one before it stays in the current zone;
 * - a big jump in colour from the previous frame, or slow drift far from where the zone started,
 *   is a scene cut;
 * - at a cut, the frame is compared with every zone seen so far, so walking back to an area
 *   (the stage again, the back wall again) rejoins that zone's id instead of opening a new one.
 *
 * Pure logic, no DOM: the browser hands in RGBA pixels from a small canvas. Ids are small
 * integers from 0 in order of first appearance, matching PlanRequest.frames[].zoneId.
 */

/** Side of the square thumbnail the browser draws each frame into before signing it. */
export const SIGNATURE_SIDE = 32;

/** Bins per RGB channel in the colour histogram (4 x 4 x 4 = 64 bins). */
const BINS = 4;

export interface FrameSignature {
  /** Normalised colour histogram, BINS^3 entries summing to 1. */
  hist: Float32Array;
  /** 64-bit dHash as 8 bytes (row-major, 1 bit per horizontal neighbour pair). */
  dhash: Uint8Array;
}

export interface ZoneOptions {
  /** Histogram distance to the previous frame above which a scene cut is called. Default 0.25. */
  cutThreshold?: number;
  /** Histogram distance to the first frame of the current visit above which slow drift is a cut. Default 0.4. */
  driftThreshold?: number;
  /** Combined distance (signatureDistance) to an earlier visit's frame below which a cut rejoins that zone. Default 0.18. */
  revisitThreshold?: number;
  /** Most zones to open; past this a cut joins the nearest zone. Default 8. */
  maxZones?: number;
  /** Last frames of the current visit that a cut can't match (about 6 s at one frame per 2 s). Default 3. */
  recentFrames?: number;
}

/*
 * Defaults calibrated offline on the five sanctuary walkthroughs (IMG_9139-9142, walk01; one frame
 * every 2 s at 32 x 32): frame-to-frame colour distance inside one clip stays at or under 0.24, the
 * jump between clips is 0.2-0.8 (0.28-0.30 between clips joined into one 64 s test take), and
 * colour drift from a clip's first frame reaches ~0.41 at the 90th percentile. One sanctuary looks alike from everywhere (nearest frame in another
 * clip: combined distance 0.15-0.30), so the revisit bar is set low: a real return to a spot scores
 * well under 0.1, and a missed revisit only widens the server's range instead of double-counting.
 */
const ZONE_DEFAULTS: Required<ZoneOptions> = {
  cutThreshold: 0.25,
  driftThreshold: 0.4,
  revisitThreshold: 0.18,
  maxZones: 8,
  recentFrames: 3,
};

/**
 * Signature from RGBA pixels (width * height * 4 bytes, e.g. canvas getImageData).
 * Any size works; the dHash box-averages down to 9 x 8 grey.
 */
export function frameSignature(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): FrameSignature {
  const hist = new Float32Array(BINS * BINS * BINS);
  const n = width * height;
  if (n <= 0 || rgba.length < n * 4) return { hist, dhash: new Uint8Array(8) };
  const shift = 8 - Math.log2(BINS);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    hist[((rgba[o] >> shift) * BINS + (rgba[o + 1] >> shift)) * BINS + (rgba[o + 2] >> shift)] += 1 / n;
  }

  // 9 x 8 grey by box average, then 1 bit per left/right pair: 8 rows x 8 bits.
  const GW = 9;
  const GH = 8;
  const grey = new Float32Array(GW * GH);
  const counts = new Uint32Array(GW * GH);
  for (let y = 0; y < height; y++) {
    const gy = Math.min(GH - 1, Math.floor((y * GH) / height));
    for (let x = 0; x < width; x++) {
      const gx = Math.min(GW - 1, Math.floor((x * GW) / width));
      const o = (y * width + x) * 4;
      grey[gy * GW + gx] += 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
      counts[gy * GW + gx]++;
    }
  }
  for (let i = 0; i < grey.length; i++) grey[i] = counts[i] ? grey[i] / counts[i] : 0;
  const dhash = new Uint8Array(8);
  for (let y = 0; y < GH; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) if (grey[y * GW + x] > grey[y * GW + x + 1]) byte |= 1 << x;
    dhash[y] = byte;
  }
  return { hist, dhash };
}

/** Half the L1 distance between two normalised histograms: 0 identical, 1 nothing in common. */
export function histDistance(a: Float32Array, b: Float32Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - (b[i] ?? 0));
  return Math.min(1, d / 2);
}

/** Differing dHash bits over 64: 0 same layout, about 0.5 unrelated. */
export function hashDistance(a: Uint8Array, b: Uint8Array): number {
  let bits = 0;
  for (let i = 0; i < 8; i++) {
    let x = (a[i] ?? 0) ^ (b[i] ?? 0);
    while (x) {
      bits += x & 1;
      x >>= 1;
    }
  }
  return bits / 64;
}

/** Colour and layout together; layout weighs a little more so similar-coloured areas stay apart. */
export function signatureDistance(a: FrameSignature, b: FrameSignature): number {
  return 0.45 * histDistance(a.hist, b.hist) + 0.55 * hashDistance(a.dhash, b.dhash);
}

/**
 * One zone id per signature, in the same order. Empty in, empty out. See the module comment for
 * the rules. A run of one frame (a glance away, a blurred step) is folded into the run before it,
 * or the run after it when it opens the take, so every zone has at least two frames when the take
 * has at least two.
 */
export function assignZones(signatures: FrameSignature[], options: ZoneOptions = {}): number[] {
  const o = { ...ZONE_DEFAULTS, ...options };
  if (signatures.length === 0) return [];
  const ids = [0];
  let zones = 1;
  let visitStart = 0; // first frame index of the current visit to the current zone
  for (let i = 1; i < signatures.length; i++) {
    const s = signatures[i];
    const current = ids[i - 1];
    const fromPrev = histDistance(s.hist, signatures[i - 1].hist);
    const fromVisitStart = histDistance(s.hist, signatures[visitStart].hist);
    if (fromPrev < o.cutThreshold && fromVisitStart < o.driftThreshold) {
      ids.push(current);
      continue;
    }
    // Scene cut. Nearest earlier frame, leaving out the tail of the current visit (what we just cut
    // away or drifted from), so a loop back to any earlier spot, in this zone or another, rejoins it.
    const tail = Math.max(visitStart, i - o.recentFrames);
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < tail; j++) {
      const d = signatureDistance(s, signatures[j]);
      if (d < bestD) {
        bestD = d;
        best = ids[j];
      }
    }
    let next: number;
    if (best >= 0 && bestD < o.revisitThreshold) next = best;
    else if (zones < o.maxZones) next = zones++;
    else next = best >= 0 ? best : current;
    ids.push(next);
    visitStart = i;
  }
  return renumber(foldShortRuns(ids));
}

/** Merges runs of a single frame into a neighbouring run (the one before, else the one after). */
function foldShortRuns(ids: number[]): number[] {
  const out = ids.slice();
  if (out.length < 2) return out;
  for (let i = 0; i < out.length; i++) {
    const startsRun = i === 0 || out[i] !== out[i - 1];
    const endsRun = i === out.length - 1 || out[i] !== out[i + 1];
    if (startsRun && endsRun) out[i] = i > 0 ? out[i - 1] : out[i + 1];
  }
  return out;
}

/** Relabels ids 0, 1, 2... in order of first appearance (gaps left by folded detours close up). */
export function renumber(ids: number[]): number[] {
  const map = new Map<number, number>();
  return ids.map((z) => {
    if (!map.has(z)) map.set(z, map.size);
    return map.get(z)!;
  });
}

/** Frame indices where the zone changes (the first frame of each run), always including 0. */
export function zoneChangeIndices(ids: number[]): number[] {
  return ids.flatMap((z, i) => (i === 0 || z !== ids[i - 1] ? [i] : []));
}
