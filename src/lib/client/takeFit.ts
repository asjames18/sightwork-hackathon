/**
 * How a saved take's length fits the chosen room size, for the "Your saved takes" list on /start, so the
 * best of several takes filmed back to back is easy to pick. Uses the same rules as the upload check
 * (duration.ts), so a take marked "Too long" is the one the upload check would refuse. Pure, so
 * tools/test can check it.
 */
import { aimRange, aimRangeSpoken, durationRulesFor, shortLength, spokenLength } from "./duration";

export type TakeFitTone = "good" | "short" | "long" | "block";

export interface TakeFit {
  tone: TakeFitTone;
  /** Short visible line, e.g. "Good length for Large (90 s–3 min)". */
  text: string;
  /** Fuller line for screen readers. */
  aria: string;
}

/** Null when the take's length is unknown, so nothing is claimed about it. */
export function takeFit(durationSec: number | null | undefined, size?: string | null): TakeFit | null {
  if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  const r = durationRulesFor(size);
  const name = r.label;
  const aim = aimRange(r);
  const aimSpoken = aimRangeSpoken(r);
  if (durationSec < r.minSec)
    return { tone: "block", text: "Too short for a plan", aria: `Too short for a plan. Walk the whole space for ${aimSpoken}.` };
  if (durationSec > r.hardMaxSec)
    return {
      tone: "block",
      text: `Too long for ${name} (max ${shortLength(r.hardMaxSec)})`,
      aria: `Too long for a ${name.toLowerCase()} space: over ${spokenLength(r.hardMaxSec)}, so it can't be used at this room size.`,
    };
  if (durationSec > r.warnAfterSec)
    return {
      tone: "long",
      text: `Near the limit for ${name} (max ${shortLength(r.hardMaxSec)})`,
      aria: `Near the most for a ${name.toLowerCase()} space (${spokenLength(r.hardMaxSec)}). It still works.`,
    };
  if (durationSec < r.aimMinSec)
    return { tone: "short", text: `Short for ${name} (aim ${aim})`, aria: `Short for a ${name.toLowerCase()} space. It still works, but ${aimSpoken} covers more of it.` };
  return { tone: "good", text: `Good length for ${name}`, aria: `Good length for a ${name.toLowerCase()} space (${aimSpoken}).` };
}
