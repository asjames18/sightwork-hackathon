/** How far one crew ("Who does the work" row) has got, from the steps ticked off on this device. */
export interface CrewProgress {
  /** Steps of this crew that are ticked off. */
  done: number;
  /** Steps this crew covers. */
  total: number;
  /** Lowest step of this crew not ticked off yet, or null when all are done. */
  next: number | null;
}

/** Progress for one crew, or null when nothing of theirs is ticked off (the row stays as it was) or they have no steps. */
export function crewProgress(steps: readonly number[], done: readonly number[]): CrewProgress | null {
  if (steps.length === 0) return null;
  const doneSet = new Set(done);
  const mine = steps.filter((s) => doneSet.has(s)).length;
  if (mine === 0) return null;
  const open = steps.filter((s) => !doneSet.has(s)).sort((a, b) => a - b);
  return { done: mine, total: steps.length, next: open.length > 0 ? open[0] : null };
}

/** Short chip text: "All done", "1 of 3 done, next step 4". */
export function crewProgressLabel(p: CrewProgress): string {
  if (p.next === null) return p.total === 1 ? "Done" : "All done";
  return `${p.done} of ${p.total} done, next step ${p.next}`;
}

/** Fuller sentence for screen readers and the hover title. */
export function crewProgressDescription(label: string, p: CrewProgress): string {
  if (p.next === null) return `${label}: every step is ticked off as done.`;
  const left = p.total - p.done;
  return `${label}: ${p.done} of ${p.total} steps ticked off as done, ${left} to go. Next is step ${p.next}.`;
}
