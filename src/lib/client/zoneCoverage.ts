/**
 * Zone coverage: when only some frames of a take can be used (a frame cap, a SAM request budget),
 * keep at least one frame from every zone, then fill the rest evenly.
 *
 * Why: segment.ts sums per-zone maxima (proposal B). A zone with no counted frame adds 0, so a
 * short area at the end of the walk drops out of the total (finding B, grokbot-log Oct 29 6:50 PM
 * ET). The browser already sends every sampled frame with its zoneId, so the payload covers every
 * zone by construction; this helper is the guard for anything that trims frames afterwards.
 *
 * With no zoneIds it returns exactly what segment.ts's evenlySpaced returns, so it can stand in for
 * that call without changing a take that has no zones. Pure logic, no DOM, no network.
 */

/** Same picks as segment.ts evenlySpaced: candidates[floor(i * n / count)], deduped, sorted. */
export function evenlyPick(candidates: number[], count: number): number[] {
  if (count <= 0 || candidates.length === 0) return [];
  if (count >= candidates.length) return [...candidates];
  const picked: number[] = [];
  for (let i = 0; i < count; i++) picked.push(candidates[Math.floor((i * candidates.length) / count)]);
  return [...new Set(picked)].sort((a, b) => a - b);
}

/** Zone key for a frame: its zoneId, or "u" for frames without one (they form their own zone, as in segment.ts). */
function key(zoneId: number | undefined): string {
  return typeof zoneId === "number" ? String(zoneId) : "u";
}

/**
 * One frame index per zone among the candidates: the middle of the zone's longest run of
 * consecutive candidates (a steady view rather than the cut frame). Zones in order of first
 * appearance. zoneIds is indexed by frame index.
 */
export function zoneRepresentatives(candidates: number[], zoneIds: (number | undefined)[]): number[] {
  const runs = new Map<string, { best: number[]; cur: number[] }>();
  let prevKey: string | null = null;
  for (const idx of candidates) {
    const k = key(zoneIds[idx]);
    let z = runs.get(k);
    if (!z) runs.set(k, (z = { best: [], cur: [] }));
    if (k !== prevKey) z.cur = [];
    z.cur.push(idx);
    if (z.cur.length > z.best.length) z.best = [...z.cur];
    prevKey = k;
  }
  return [...runs.values()].map((z) => z.best[Math.floor((z.best.length - 1) / 2)]);
}

/**
 * Picks `count` of the candidate frame indices so every zone keeps at least one, then fills the
 * remaining slots evenly. When there are more zones than slots, the zones with the most candidate
 * frames win (earlier zone on a tie). Without zoneIds (or a single zone) this is evenlyPick.
 * Returns sorted, unique indices.
 */
export function coverZones(candidates: number[], zoneIds: (number | undefined)[], count: number): number[] {
  if (count <= 0 || candidates.length === 0) return [];
  if (count >= candidates.length) return [...candidates];
  const zoneKeys = new Set(candidates.map((i) => key(zoneIds[i])));
  if (zoneKeys.size <= 1 || !candidates.some((i) => typeof zoneIds[i] === "number")) return evenlyPick(candidates, count);

  let reps = zoneRepresentatives(candidates, zoneIds);
  if (reps.length > count) {
    const size = (r: number) => candidates.filter((i) => key(zoneIds[i]) === key(zoneIds[r])).length;
    reps = reps
      .map((r, order) => ({ r, order, n: size(r) }))
      .sort((a, b) => b.n - a.n || a.order - b.order)
      .slice(0, count)
      .map((x) => x.r);
  }
  const chosen = new Set(reps);
  const rest = candidates.filter((i) => !chosen.has(i));
  for (const i of evenlyPick(rest, count - chosen.size)) chosen.add(i);
  return [...chosen].sort((a, b) => a - b);
}

/** Zone keys present in the candidates but missing from the picked indices (empty when every zone is covered). */
export function missingZones(candidates: number[], picked: number[], zoneIds: (number | undefined)[]): string[] {
  const have = new Set(picked.map((i) => key(zoneIds[i])));
  return [...new Set(candidates.map((i) => key(zoneIds[i])))].filter((k) => !have.has(k));
}

/** Trims frames to at most max, keeping one per zone (see coverZones). Frames stay in time order. */
export function trimFramesCoveringZones<F extends { zoneId?: number }>(frames: F[], max: number): F[] {
  if (frames.length <= max) return frames;
  const all = frames.map((_, i) => i);
  return coverZones(all, frames.map((f) => f.zoneId), max).map((i) => frames[i]);
}
