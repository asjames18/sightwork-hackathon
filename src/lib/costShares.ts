/**
 * A cost for each problem and each work step that adds up exactly to the plan's total (richer findings, item 7).
 *
 * The server works out the shares (cost.ts, Mosheh's lane: each material and paid step priced, shared
 * lines split, contingency on every line) and sends them as costRange.byIssue and costRange.byStep. This
 * module only checks them and makes the numbers on screen add up: each list is scaled to the total when it
 * is a little off, then rounded to whole dollars with the largest-remainder rule, so the displayed shares
 * sum exactly to the displayed low and high. A list that can't be trusted (missing, unknown ranks or
 * steps, negative or inverted figures, far off the total) is left off, and the screen shows the total alone.
 * Field names as proposed in handoffs/grokbot-log.md (Oct 30, 4:30 PM ET). Pure, no DOM.
 */
import type { CostRange, WorkPlan } from "./types";

export interface CostShare {
  /** Issue rank or step order. */
  key: number;
  low: number;
  high: number;
}

/** How far (as a share of the total) the server's sum may be off before the list is dropped as untrustworthy. */
export const SUM_TOLERANCE = 0.05;

/**
 * Whole numbers that sum exactly to round(total), proportional to `parts` (largest remainder).
 * All-zero parts with a non-zero total can't be split: returns null.
 */
export function apportion(parts: number[], total: number): number[] | null {
  const target = Math.round(total);
  const sum = parts.reduce((a, b) => a + b, 0);
  if (parts.length === 0) return target === 0 ? [] : null;
  if (sum <= 0) return target === 0 ? parts.map(() => 0) : null;
  const exact = parts.map((p) => (p / sum) * target);
  const floors = exact.map(Math.floor);
  let left = target - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) floors[order[k].i] += 1;
  return floors;
}

function readList(v: unknown, keyName: "rank" | "order", valid: Set<number>): { key: number; low: number; high: number }[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const seen = new Set<number>();
  const out: { key: number; low: number; high: number }[] = [];
  for (const r of v) {
    if (!r || typeof r !== "object") return null;
    const o = r as Record<string, unknown>;
    const key = o[keyName];
    const low = o.low;
    const high = o.high;
    if (typeof key !== "number" || !valid.has(key) || seen.has(key)) return null;
    if (typeof low !== "number" || typeof high !== "number" || !Number.isFinite(low) || !Number.isFinite(high) || low < 0 || low > high) return null;
    seen.add(key);
    out.push({ key, low, high });
  }
  return out;
}

function reconcile(list: { key: number; low: number; high: number }[], c: CostRange): CostShare[] | null {
  const sumLow = list.reduce((a, s) => a + s.low, 0);
  const sumHigh = list.reduce((a, s) => a + s.high, 0);
  const off = (sum: number, total: number) => (total === 0 ? sum !== 0 : Math.abs(sum - total) / total > SUM_TOLERANCE);
  if (off(sumLow, c.low) || off(sumHigh, c.high)) return null;
  const lows = apportion(list.map((s) => s.low), c.low);
  const highs = apportion(list.map((s) => s.high), c.high);
  if (!lows || !highs) return null;
  const shares = list.map((s, i) => ({ key: s.key, low: lows[i], high: Math.max(lows[i], highs[i]) }));
  // Keeping high >= low can only add to a high; if that broke the exact sum, don't show a list that doesn't add up.
  if (shares.reduce((a, s) => a + s.high, 0) !== Math.round(c.high)) return null;
  return shares;
}

/** The displayed total, in whole dollars, that the shares sum to. */
export function displayedTotal(c: CostRange): { low: number; high: number } {
  return { low: Math.round(c.low), high: Math.round(c.high) };
}

/** Per-problem shares keyed by rank, or null when the plan has none that can be trusted. */
export function issueCostShares(plan: Pick<WorkPlan, "costRange" | "issues">): Map<number, CostShare> | null {
  const c = plan.costRange;
  if (!c) return null;
  const list = readList((c as CostRange & { byIssue?: unknown }).byIssue, "rank", new Set(plan.issues.map((i) => i.rank)));
  const shares = list && reconcile(list, c);
  return shares ? new Map(shares.map((s) => [s.key, s])) : null;
}

/** Per-step shares keyed by step order, or null. */
export function stepCostShares(plan: Pick<WorkPlan, "costRange" | "workOrder">): Map<number, CostShare> | null {
  const c = plan.costRange;
  if (!c) return null;
  const list = readList((c as CostRange & { byStep?: unknown }).byStep, "order", new Set(plan.workOrder.map((s) => s.order)));
  const shares = list && reconcile(list, c);
  return shares ? new Map(shares.map((s) => [s.key, s])) : null;
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** "$25–60" style label for a share ("$40" when low equals high). */
export function shareLabel(s: { low: number; high: number }): string {
  return s.low === s.high ? usd(s.low) : `${usd(s.low)}–${usd(s.high).replace("$", "")}`;
}
