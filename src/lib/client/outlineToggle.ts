/**
 * Words for the full-size proof photo's outline toggle. The outline is shown by default; hiding it
 * lets you see what is under the box. Only offered when the photo has a box to hide.
 */
export function outlineToggleLabel(hidden: boolean): string {
  return hidden ? "Show outline" : "Hide outline";
}

/** Screen-reader announcement after a toggle, naming who drew the box when known. */
export function outlineToggleStatus(hidden: boolean, source?: "sam" | "model"): string {
  if (hidden) return "Outline hidden. The whole photo is in view.";
  return source === "sam" ? "Outline shown, as drawn by SAM 3.1." : "Outline shown.";
}

/** The toggle only appears when there is a usable box on the photo. */
export function canToggleOutline(box: unknown): boolean {
  return (
    Array.isArray(box) &&
    box.length === 4 &&
    box.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    box[2] !== box[0] &&
    box[3] !== box[1]
  );
}
