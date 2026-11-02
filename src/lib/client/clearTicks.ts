/**
 * Wording for the note that follows "Clear ticks" on the work steps and the shopping list, so the crew sees what
 * was cleared and can put it back with Undo.
 */
export type TickNoun = "step" | "item";

/** "Cleared 3 ticked steps." / "Cleared 1 ticked item." Empty when nothing was cleared. */
export function clearedLine(count: number, noun: TickNoun): string {
  if (!Number.isFinite(count) || count < 1) return "";
  const n = Math.floor(count);
  return `Cleared ${n} ticked ${noun}${n === 1 ? "" : "s"}.`;
}

/** Accessible name for the Undo button: "Undo: tick the 3 steps again". */
export function undoClearLabel(count: number, noun: TickNoun): string {
  const n = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
  return n === 1 ? `Undo: tick the ${noun} again` : `Undo: tick the ${n} ${noun}s again`;
}

/** The ticks to put back: the cleared ones plus any ticked since, each once, in order. */
export function restoredTicks(cleared: readonly number[], current: readonly number[]): number[] {
  return [...new Set([...cleared, ...current])].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
}
