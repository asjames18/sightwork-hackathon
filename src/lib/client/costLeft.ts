import type { CostShare } from "@/lib/costShares";
import type { WorkStep } from "@/lib/types";

/**
 * What's still to spend once a crew has ticked some steps off: the summed cost shares of the unticked steps.
 * Null when the plan has no per-step costs, nothing is ticked yet, or everything is done. Pure, no DOM.
 */
export function costLeft(
  workOrder: readonly Pick<WorkStep, "order">[],
  stepCosts: ReadonlyMap<number, CostShare> | null,
  done: readonly number[],
): { low: number; high: number; steps: number } | null {
  if (!stepCosts || stepCosts.size === 0) return null;
  const ticked = new Set(done);
  const orders = workOrder.map((s) => s.order);
  if (!orders.some((n) => ticked.has(n))) return null;
  const left = orders.filter((n) => !ticked.has(n));
  if (left.length === 0) return null;
  let low = 0;
  let high = 0;
  for (const n of left) {
    const s = stepCosts.get(n);
    if (!s) continue;
    low += s.low;
    high += s.high;
  }
  return { low, high, steps: left.length };
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * "About $1,000–$2,241 of this is for the 3 steps not ticked yet." / "...for the last step."
 * "Nothing left to spend on the 2 steps not ticked yet." when the steps left cost nothing.
 */
export function costLeftLine(left: ReturnType<typeof costLeft>): string {
  if (!left) return "";
  const where = left.steps === 1 ? "the last step" : `the ${left.steps} steps not ticked yet`;
  if (left.high === 0) return `Nothing left to spend on ${where}.`;
  const amount = left.low === left.high ? usd(left.low) : `${usd(left.low)}–${usd(left.high)}`;
  return `About ${amount} of this is for ${where}.`;
}
