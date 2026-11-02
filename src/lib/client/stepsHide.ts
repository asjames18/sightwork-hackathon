/**
 * "Hide the N done" on the work steps: once some steps are ticked and some are left,
 * the crew can tuck the finished ones away and see only the work still to do.
 */

/** Whether the toggle is worth showing: something is done and something is still left. */
export function canHideDone(done: number, total: number): boolean {
  return total > 1 && done > 0 && done < total;
}

/** Toggle text: "Hide the 2 done" while showing everything, "Show all steps" while hiding. */
export function hideDoneLabel(done: number, hidden: boolean): string {
  if (hidden) return "Show all steps";
  return done === 1 ? "Hide the 1 done" : `Hide the ${done} done`;
}

/** Short note shown while finished steps are hidden ("2 done steps hidden."), or "" when nothing is hidden. */
export function hiddenDoneLine(done: number, hidden: boolean): string {
  if (!hidden || done <= 0) return "";
  return done === 1 ? "1 done step hidden." : `${done} done steps hidden.`;
}

/**
 * The step a link points at when it is one of the hidden done steps, so the list can show it again.
 * Accepts "#step-3" or "step-3"; returns null for anything else or a step that isn't done.
 */
export function hiddenStepTarget(hash: string, done: readonly number[]): number | null {
  const m = /^#?step-(\d+)$/.exec(hash.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return done.includes(n) ? n : null;
}
