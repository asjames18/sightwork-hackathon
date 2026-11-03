import type { CostShare } from "@/lib/costShares";
import type { WorkStep } from "@/lib/types";

/** The most a typed budget can be; anything bigger is treated as a typo. */
export const MAX_BUDGET = 10_000_000;

/** "$2,500", "2500" or "2,500.75" as whole dollars; null when empty, not a number, zero or too big. */
export function parseBudget(input: string): number | null {
  const cleaned = input.replace(/[\s$,]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Math.floor(Number(cleaned));
  if (!Number.isFinite(n) || n <= 0 || n > MAX_BUDGET) return null;
  return n;
}

export interface BudgetFit {
  budget: number;
  /** Orders of the steps not ticked yet, in work order. */
  left: number[];
  /** Leading steps whose costs fit the budget even at the high end. */
  sure: number[];
  /** Further leading steps that fit only if prices land at the low end (empty when none). */
  maybe: number[];
  /** What finishing every step left would need beyond the budget, as a range (low may be 0). Null when everything is covered for sure. */
  stillNeed: { low: number; high: number } | null;
  /** The first step the budget does not cover for sure, with its range; null when everything is covered. */
  next: { order: number; low: number; high: number } | null;
}

/**
 * What a budget covers: working through the steps not ticked yet in work order, how many fit when each
 * costs its high figure (for sure) and how many more fit at the low figure (might). Steps are never
 * skipped to squeeze a later one in, because a later step may wait on an earlier one. Null when the plan
 * has no step costs, nothing is left, or the budget is not a positive number. Pure, no DOM.
 */
export function budgetFit(
  workOrder: readonly Pick<WorkStep, "order">[],
  stepCosts: ReadonlyMap<number, CostShare> | null,
  done: readonly number[],
  budget: number | null,
): BudgetFit | null {
  if (!stepCosts || stepCosts.size === 0 || budget === null || !(budget > 0)) return null;
  const ticked = new Set(done);
  const left = workOrder.map((s) => s.order).filter((n) => !ticked.has(n));
  if (left.length === 0) return null;
  const cost = (n: number) => stepCosts.get(n) ?? { key: n, low: 0, high: 0 };
  let high = 0;
  const sure: number[] = [];
  for (const n of left) {
    if (high + cost(n).high > budget) break;
    high += cost(n).high;
    sure.push(n);
  }
  let low = sure.reduce((a, n) => a + cost(n).low, 0);
  const maybe: number[] = [];
  for (const n of left.slice(sure.length)) {
    if (low + cost(n).low > budget) break;
    low += cost(n).low;
    maybe.push(n);
  }
  if (sure.length === left.length) return { budget, left, sure, maybe: [], stillNeed: null, next: null };
  const totalLow = left.reduce((acc, n) => acc + cost(n).low, 0);
  const totalHigh = left.reduce((acc, n) => acc + cost(n).high, 0);
  const nextOrder = left[sure.length];
  return {
    budget,
    left,
    sure,
    maybe,
    // The whole left-over work against the budget: nothing at the low end if the budget already reaches it.
    stillNeed: { low: Math.max(0, totalLow - budget), high: Math.max(0, totalHigh - budget) },
    next: { order: nextOrder, low: cost(nextOrder).low, high: cost(nextOrder).high },
  };
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const range = (low: number, high: number) => (low === high ? usd(low) : `${usd(low)}–${usd(high)}`);

/** "step 2", "steps 2 and 3", "steps 1–3 and 5", "steps 1, 4 and 6–8" from step numbers in any order. */
export function stepsLabel(orders: readonly number[]): string {
  const sorted = [...new Set(orders)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    runs.push(j - i >= 2 ? `${sorted[i]}–${sorted[j]}` : j - i === 1 ? `${sorted[i]}, ${sorted[j]}` : String(sorted[i]));
    i = j + 1;
  }
  const parts = runs.join(", ").split(", ");
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${sorted.length === 1 ? "step" : "steps"} ${joined}`;
}

/** The plain-language answer for the cost card. Empty string when there is nothing to say. */
export function budgetFitLine(fit: BudgetFit | null): string {
  if (!fit) return "";
  const b = usd(fit.budget);
  if (fit.next === null) {
    return fit.left.length === 1
      ? `${b} covers the last step, even if prices come in high.`
      : `${b} covers all ${fit.left.length} steps left, even if prices come in high.`;
  }
  const parts: string[] = [];
  if (fit.sure.length > 0) {
    parts.push(`${b} covers ${stepsLabel(fit.sure)} even if prices come in high.`);
  } else {
    parts.push(`${b} doesn\u2019t cover step ${fit.next.order} for sure (about ${range(fit.next.low, fit.next.high)}).`);
  }
  if (fit.maybe.length > 0) parts.push(`It might ${fit.sure.length > 0 ? "also " : ""}stretch to ${stepsLabel(fit.maybe)} if prices come in low.`);
  if (fit.stillNeed && fit.stillNeed.high > 0) {
    const all = fit.left.length === 1 ? "the last step" : `all ${fit.left.length} steps left`;
    const more = fit.stillNeed.low > 0 ? `about ${range(fit.stillNeed.low, fit.stillNeed.high)} more` : `up to ${usd(fit.stillNeed.high)} more`;
    parts.push(`To finish ${all} you\u2019d need ${more}.`);
  }
  return parts.join(" ");
}
