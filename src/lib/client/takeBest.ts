/**
 * Which saved take to use, for the "Your saved takes" list on /start: after filming several takes back
 * to back, one row is marked "Best pick" so the right one is obvious at a glance. Built on takeFit, so it
 * follows the room size picker and never picks a take the upload check would refuse. Pure, so tools/test
 * can check it.
 *
 * Order: a good length first, then one near the limit (it still works), then a short one. Among good
 * lengths, the one closest to the middle of the aim range; near the limit, the shorter; short, the longer.
 * Ties go to the newest (the list is newest first). Nothing is marked with fewer than two takes, or when
 * no take has a usable length.
 */
import { durationRulesFor } from "./duration";
import { takeFit, type TakeFitTone } from "./takeFit";

const TONE_RANK: Partial<Record<TakeFitTone, number>> = { good: 0, long: 1, short: 2 };

export interface TakeLength {
  id: string;
  durationSec: number | null;
}

export interface TakeBest {
  id: string;
  /** Short visible pill, e.g. "Best pick for Large". */
  text: string;
  /** Fuller line for screen readers. */
  aria: string;
}

export function bestTake(takes: readonly TakeLength[], size?: string | null): TakeBest | null {
  if (!Array.isArray(takes) || takes.length < 2) return null;
  const r = durationRulesFor(size);
  const mid = (r.aimMinSec + r.aimMaxSec) / 2;
  let best: { id: string; rank: number; score: number } | null = null;
  for (const t of takes) {
    if (!t || typeof t.id !== "string" || !t.id) continue;
    const fit = takeFit(t.durationSec, size);
    const rank = fit ? TONE_RANK[fit.tone] : undefined;
    if (rank === undefined) continue;
    const d = t.durationSec as number;
    // Lower score is better within a tone.
    const score = fit!.tone === "good" ? Math.abs(d - mid) : fit!.tone === "long" ? d : -d;
    if (!best || rank < best.rank || (rank === best.rank && score < best.score)) best = { id: t.id, rank, score };
  }
  if (!best) return null;
  const name = r.label;
  return {
    id: best.id,
    text: `Best pick for ${name}`,
    aria: `Best pick of these takes for a ${name.toLowerCase()} space, by length.`,
  };
}
