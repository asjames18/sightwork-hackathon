import type { InventoryItem } from "@/lib/types";

/** Below this, a count tile says to check it by hand. */
export const LOW_COUNT_CONFIDENCE = 0.5;

export type CountMethodNote = {
  /** One short line under the count, e.g. "Counted from SAM 3.1 outlines". */
  text: string;
  /** True when the count is a guess worth checking in person. */
  low: boolean;
};

/**
 * How one inventory count was made, in plain words, for the line under its tile.
 * `masks` is false when the outline step was skipped this run, so a "sam" method can't be claimed.
 * Returns null when the plan doesn't say how the count was made and the confidence is fine.
 */
export function countMethodNote(item: InventoryItem, masks: boolean): CountMethodNote | null {
  const low = Number.isFinite(item.confidence) && item.confidence < LOW_COUNT_CONFIDENCE;
  let text: string | null = null;
  const usedSam = masks && (item.method === "sam" || item.method === "sam+model");
  if (usedSam && item.range) text = "SAM 3.1 outlines and the model differ, so a range";
  else if (usedSam && item.method === "sam+model") text = "SAM 3.1 outlines and the model agree";
  else if (usedSam) text = "Counted from SAM 3.1 outlines";
  else if (item.method === "model" || (item.method && !masks)) text = "Estimated by the model from the frames";
  if (low) text = text ? `${text}. Low confidence, check by hand` : "Low confidence, check by hand";
  return text ? { text, low } : null;
}
