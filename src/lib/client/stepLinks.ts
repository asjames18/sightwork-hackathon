import type { WorkStep } from "@/lib/types";

/** Anchor id of a problem card on the plan screen. */
export const problemAnchor = (rank: number) => `problem-${rank}`;
/** Anchor id of a work step on the plan screen. */
export const stepAnchor = (order: number) => `step-${order}`;

/** Orders of the steps whose fixes list this problem's rank, in step order, each once. */
export function stepsFixing(workOrder: readonly WorkStep[], rank: number): number[] {
  const out = new Set<number>();
  for (const step of workOrder) {
    if (Array.isArray(step.fixes) && step.fixes.includes(rank) && Number.isInteger(step.order)) out.add(step.order);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Splits a step's fixes into ranks that have a problem card to link to and ranks that don't (a watch item,
 * or a rank the plan step got wrong), keeping the step's order and dropping repeats.
 */
export function fixLinks(fixes: readonly number[] | undefined, shownRanks: ReadonlySet<number>): { linked: number[]; plain: number[] } {
  const linked: number[] = [];
  const plain: number[] = [];
  const seen = new Set<number>();
  for (const r of fixes ?? []) {
    if (seen.has(r)) continue;
    seen.add(r);
    (shownRanks.has(r) ? linked : plain).push(r);
  }
  return { linked, plain };
}

/** "Fixed in step 3", "Fixed in steps 2 and 4", "Fixed in steps 1, 3 and 5"; null when no step fixes it. */
export function fixedInLabel(orders: readonly number[]): string | null {
  if (orders.length === 0) return null;
  if (orders.length === 1) return `Fixed in step ${orders[0]}`;
  const head = orders.slice(0, -1).join(", ");
  return `Fixed in steps ${head} and ${orders[orders.length - 1]}`;
}
