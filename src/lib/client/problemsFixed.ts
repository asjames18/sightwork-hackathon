import type { Issue, WorkStep } from "@/lib/types";
import { allStepsDone } from "./stepProgress";
import { stepsFixing } from "./stepLinks";

/** How many problems are fixed so far, counting only problems that some work step fixes. */
export interface ProblemsFixed {
  /** Problems whose fixing steps are all ticked off. */
  fixed: number;
  /** Problems that at least one work step fixes. */
  total: number;
  /** Problems no work step fixes, so they can't be ticked off here. */
  untracked: number;
  /** Line for the screen, e.g. "2 of 5 problems fixed". */
  line: string;
  /** Whole-number percent for the bar, 0 to 100. */
  percent: number;
}

/**
 * Tally for the top of the Problems list. Null until a step is ticked off (an untouched plan needs no
 * "0 fixed" line) and when no step fixes any problem.
 */
export function problemsFixed(
  issues: readonly Pick<Issue, "rank">[],
  workOrder: readonly WorkStep[],
  done: readonly number[],
): ProblemsFixed | null {
  if (done.length === 0) return null;
  let fixed = 0;
  let total = 0;
  for (const issue of issues) {
    const orders = stepsFixing(workOrder, issue.rank);
    if (orders.length === 0) continue;
    total++;
    if (allStepsDone(orders, done)) fixed++;
  }
  if (total === 0) return null;
  const noun = total === 1 ? "problem" : "problems";
  const line = fixed < total ? `${fixed} of ${total} ${noun} fixed` : total === 1 ? "Problem fixed" : `All ${total} problems fixed`;
  return { fixed, total, untracked: issues.length - total, line, percent: Math.round((fixed / total) * 100) };
}
