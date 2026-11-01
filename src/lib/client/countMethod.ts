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
export function countMethodNote(item: InventoryItem, masks: boolean, shared: string | null = null): CountMethodNote | null {
  const low = Number.isFinite(item.confidence) && item.confidence < LOW_COUNT_CONFIDENCE;
  let text = baseMethodText(item, masks);
  // Said once under the tiles (sharedCountMethod), so the tile keeps only its own hand-check flag.
  if (shared && text === shared) text = null;
  if (low) text = text ? `${text}. Low confidence, check by hand` : "Low confidence, check by hand";
  return text ? { text, low } : null;
}

/** How one count was made, without the confidence flag; null when the plan doesn't say. */
function baseMethodText(item: InventoryItem, masks: boolean): string | null {
  let text: string | null = null;
  const usedSam = masks && (item.method === "sam" || item.method === "sam+model");
  if (usedSam && item.range) text = "SAM 3.1 outlines and the model differ, so a range";
  else if (usedSam && item.method === "sam+model") text = "SAM 3.1 outlines and the model agree";
  else if (usedSam) text = "Counted from SAM 3.1 outlines";
  else if (item.method === "model" || (item.method && !masks)) text = "Estimated by the model from the frames";
  return text;
}

/**
 * The method line shared by every count, when there are two or more and all were made the same way,
 * so the screen and PDF can say it once under the tiles instead of repeating it in each one.
 * Null when there is only one count, when methods differ, or when any count doesn't say.
 */
export function sharedCountMethod(inventory: InventoryItem[], masks: boolean): string | null {
  if (inventory.length < 2) return null;
  const first = baseMethodText(inventory[0], masks);
  if (!first) return null;
  return inventory.every((i) => baseMethodText(i, masks) === first) ? first : null;
}

/** The line under the count tiles; names the shared method when there is one. */
export function countsFootnote(masks: boolean, shared: string | null): string {
  if (shared) return `${shared}, for every count here.${masks ? "" : " Exact counts come with outlines."}`;
  return masks ? "Counted from the video, from what the camera saw." : "Estimated from the frames, from what the camera saw. Exact counts come with outlines.";
}

/** Most counts named in the shared text; the rest become "and N more". */
export const MAX_SHARE_COUNTS = 5;

/**
 * One short line for the shared text: what's there and how it was counted, e.g.
 * "What's there (counted from SAM 3.1 outlines, approximate): 212 chairs, 14-16 lights, 4 exit signs (check by hand)."
 * Null when the plan has no counts.
 */
export function countsShareLine(inventory: InventoryItem[], masks: boolean): string | null {
  const items = inventory.filter((i) => Number.isInteger(i.count) && i.count >= 0 && i.label?.trim());
  if (items.length === 0) return null;
  const how = masks ? "counted from SAM 3.1 outlines, approximate" : "estimated from the frames, approximate";
  const parts = items.slice(0, MAX_SHARE_COUNTS).map((i) => {
    const usedSam = masks && (i.method === "sam" || i.method === "sam+model");
    const n = usedSam && i.range && i.range[0] !== i.range[1] ? `${i.range[0]}-${i.range[1]}` : `${i.count}`;
    const low = Number.isFinite(i.confidence) && i.confidence < LOW_COUNT_CONFIDENCE;
    const label = i.label.trim().replace(/\s+/g, " ");
    const name = /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
    return `${n} ${name}${low ? " (check by hand)" : ""}`;
  });
  if (items.length > MAX_SHARE_COUNTS) parts.push(`and ${items.length - MAX_SHARE_COUNTS} more`);
  return `What's there (${how}): ${parts.join(", ")}.`;
}
