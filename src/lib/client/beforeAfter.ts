/**
 * Preset views for the before/after comparison. The slider value is how much of the
 * before picture shows from the left edge (0 = all after, 100 = all before).
 */
export type CompareViewId = "before" | "compare" | "after";

export interface CompareView {
  id: CompareViewId;
  label: string;
  /** Slider value this view jumps to. */
  pos: number;
}

export const COMPARE_VIEWS: readonly CompareView[] = [
  { id: "before", label: "Before", pos: 100 },
  { id: "compare", label: "Compare", pos: 50 },
  { id: "after", label: "After", pos: 0 },
];

/** Keeps a slider value inside 0 to 100, rounded to a whole percent. */
export function clampComparePos(pos: number): number {
  if (!Number.isFinite(pos)) return 50;
  return Math.min(100, Math.max(0, Math.round(pos)));
}

/** Which preset the slider is on, or null when it sits anywhere else. */
export function activeCompareView(pos: number): CompareViewId | null {
  const p = clampComparePos(pos);
  return COMPARE_VIEWS.find((v) => v.pos === p)?.id ?? null;
}

/** What a screen reader hears for a slider value. */
export function compareValueText(pos: number): string {
  const p = clampComparePos(pos);
  if (p === 100) return "Showing only the before picture";
  if (p === 0) return "Showing only the after picture";
  return `${p}% before, ${100 - p}% after`;
}
