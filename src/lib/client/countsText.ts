import type { InventoryItem } from "@/lib/types";
import { LOW_COUNT_CONFIDENCE } from "./countMethod";
import { SHARE_SIGNOFF } from "./planText";

/**
 * The counts from the "What's there" tiles as plain text, for handing to whoever orders or sets up (chairs, lights,
 * signs) by share sheet or clipboard. Same numbers as the tiles: a range only when the outlines and the model differ.
 *
 *   Counts · Hope City sanctuary
 *   Approximate, counted from SAM 3.1 outlines.
 *   - 212 chairs (front rows)
 *   - 14-16 stage lights
 *   - 4 exit signs, check by hand
 *   Recount anything marked check by hand before you order or set up.
 */
export interface CountsTextOptions {
  /** False when the outline step was skipped this run, so counts are estimates from the frames. */
  masks: boolean;
  spaceName?: string;
  /** Example or sample plan: say so, so a forwarded example is never mistaken for a real count. */
  sample?: boolean;
}

const oneLine = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

/** Items worth sending: a label and a whole, non-negative count. */
export function shareableCounts(inventory: readonly InventoryItem[] | undefined): InventoryItem[] {
  return (inventory ?? []).filter((i) => Number.isInteger(i.count) && i.count >= 0 && oneLine(i.label) !== "");
}

/** "212 chairs (front rows)", "14-16 stage lights", "4 exit signs, check by hand". */
export function countLine(item: InventoryItem, masks: boolean): string {
  const usedSam = masks && (item.method === "sam" || item.method === "sam+model");
  const n = usedSam && item.range && item.range[0] !== item.range[1] ? `${item.range[0]}-${item.range[1]}` : `${item.count}`;
  const label = oneLine(item.label);
  const zone = oneLine(item.zone);
  const where = zone && !label.toLowerCase().includes(zone.toLowerCase()) ? ` (${zone})` : "";
  const low = Number.isFinite(item.confidence) && item.confidence < LOW_COUNT_CONFIDENCE;
  return `${n} ${label}${where}${low ? ", check by hand" : ""}`;
}

export function countsShareTitle(spaceName?: string): string {
  const space = oneLine(spaceName);
  return space ? `Counts: ${space}` : "Counts";
}

/** Null when nothing was counted. */
export function countsToText(inventory: readonly InventoryItem[] | undefined, opts: CountsTextOptions): string | null {
  const items = shareableCounts(inventory);
  if (items.length === 0) return null;
  const lines: string[] = [];
  if (opts.sample) lines.push("Example plan, not a real count.");
  const space = oneLine(opts.spaceName);
  lines.push(space ? `Counts · ${space}` : "Counts");
  lines.push(opts.masks ? "Approximate, counted from SAM 3.1 outlines." : "Approximate, estimated from the video frames.");
  for (const item of items) lines.push(`- ${countLine(item, opts.masks)}`);
  if (items.some((i) => Number.isFinite(i.confidence) && i.confidence < LOW_COUNT_CONFIDENCE)) {
    lines.push("Recount anything marked check by hand before you order or set up.");
  }
  lines.push("", SHARE_SIGNOFF);
  return lines.join("\n");
}
