import type { Issue, WorkStep } from "@/lib/types";
import { allStepsDone } from "./stepProgress";
import { stepsFixing } from "./stepLinks";

/** Which problems the list shows: every one, the ones the walk never mentioned, or the ones not fixed yet. */
export type ProblemFilterMode = "all" | "unmentioned" | "open";

export interface ProblemFilterOption {
  mode: ProblemFilterMode;
  label: string;
  count: number;
}

type FilterIssue = Pick<Issue, "rank"> & Partial<Pick<Issue, "unmentioned">>;

/** True when some work step fixes this problem and every one of those steps is ticked off. */
function isFixed(issue: FilterIssue, workOrder: readonly WorkStep[], done: readonly number[]): boolean {
  const orders = stepsFixing(workOrder, issue.rank);
  return orders.length > 0 && allStepsDone(orders, done);
}

/** The problems a mode keeps, in their original order. "all" (or an unknown mode) keeps every one. */
export function filterProblems<T extends FilterIssue>(
  issues: readonly T[],
  mode: ProblemFilterMode,
  ctx: { narrated: boolean; workOrder: readonly WorkStep[]; done: readonly number[] },
): T[] {
  if (mode === "unmentioned") return ctx.narrated ? issues.filter((i) => i.unmentioned) : [...issues];
  if (mode === "open") return issues.filter((i) => !isFixed(i, ctx.workOrder, ctx.done));
  return [...issues];
}

/**
 * Options for the toggle above the problems. A narrowing option is offered only when it would really narrow the
 * list (some but not all problems match): "You didn't mention" needs a narrated walk, "Still to fix" needs at least
 * one problem fixed by ticked-off steps and at least one still open. Empty when no option narrows, so the toggle
 * hides itself.
 */
export function problemFilterOptions(
  issues: readonly FilterIssue[],
  ctx: { narrated: boolean; workOrder: readonly WorkStep[]; done: readonly number[] },
): ProblemFilterOption[] {
  const total = issues.length;
  const narrows = (n: number) => n > 0 && n < total;
  const extra: ProblemFilterOption[] = [];
  const unmentioned = ctx.narrated ? issues.filter((i) => i.unmentioned).length : 0;
  if (narrows(unmentioned)) extra.push({ mode: "unmentioned", label: "You didn't mention", count: unmentioned });
  const open = filterProblems(issues, "open", ctx).length;
  if (narrows(open)) extra.push({ mode: "open", label: "Still to fix", count: open });
  return extra.length === 0 ? [] : [{ mode: "all", label: "All", count: total }, ...extra];
}

/** The mode to show: the chosen one while it is still offered, otherwise every problem. */
export function activeProblemFilter(mode: ProblemFilterMode, options: readonly ProblemFilterOption[]): ProblemFilterMode {
  return options.some((o) => o.mode === mode) ? mode : "all";
}

/** Screen-reader line for the current choice. */
export function problemFilterAnnouncement(mode: ProblemFilterMode, options: readonly ProblemFilterOption[]): string {
  const all = options.find((o) => o.mode === "all")?.count ?? 0;
  const cur = options.find((o) => o.mode === mode);
  if (!cur || mode === "all") return `Showing all ${all} problems.`;
  const what = mode === "unmentioned" ? "the ones you didn't mention" : "the ones not fixed yet";
  return `Showing ${cur.count} of ${all} problems: ${what}.`;
}
