import type { Issue, WorkStep } from "@/lib/types";
import { allStepsDone } from "./stepProgress";
import { stepsFixing } from "./stepLinks";

/** Fixed progress for one tier heading ("Fix now", "Fix soon", "Can wait"). */
export interface TierFixed {
  /** Problems in the tier whose fixing steps are all ticked off. */
  fixed: number;
  /** Problems in the tier that at least one work step fixes. */
  tracked: number;
  /** Short text after the count, e.g. "1 fixed" or "all fixed". */
  label: string;
  /** True when every tracked problem in the tier is fixed. */
  all: boolean;
}

/**
 * Progress for a tier heading. Null until a step is ticked off, when no step fixes any problem in the tier, and
 * while none of the tier's problems is fixed yet (a "0 fixed" next to every heading is noise).
 */
export function tierFixed(
  issues: readonly Pick<Issue, "rank">[],
  workOrder: readonly WorkStep[],
  done: readonly number[],
): TierFixed | null {
  if (done.length === 0) return null;
  let fixed = 0;
  let tracked = 0;
  for (const issue of issues) {
    const orders = stepsFixing(workOrder, issue.rank);
    if (orders.length === 0) continue;
    tracked++;
    if (allStepsDone(orders, done)) fixed++;
  }
  if (tracked === 0 || fixed === 0) return null;
  const all = fixed === tracked;
  return { fixed, tracked, all, label: all ? (tracked === issues.length ? "all fixed" : `${fixed} fixed`) : `${fixed} fixed` };
}

/** Screen-reader text for the heading suffix: "1 of 2 fixed". */
export function tierFixedSr(t: TierFixed): string {
  return `${t.fixed} of ${t.tracked} fixed`;
}
