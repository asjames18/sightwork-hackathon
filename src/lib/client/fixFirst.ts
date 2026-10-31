import type { Issue, WorkStep } from "@/lib/types";
import type { CostShare } from "@/lib/costShares";
import { issueTier } from "@/lib/planExtras";
import { hoursLabel } from "@/lib/client/crewSummary";

/**
 * "Start here": the Fix now problems, the steps that fix them, and the earlier steps those wait on, so a
 * leader with a small budget knows what to do first. Pure; the plan screen renders it.
 */
export interface FixFirst {
  /** Ranks of the Fix now problems, worst first. */
  ranks: number[];
  /** Ranks of Fix now problems no step fixes. */
  unplanned: number[];
  /** Orders of the steps to do first (fixing steps plus the steps they wait on), in work order. */
  steps: number[];
  /** Orders added only because a fixing step waits on them. */
  prerequisites: number[];
  /** Total steps in the plan. */
  totalSteps: number;
  /** "about 6–9 h" / "at least 2–3 h", or null when no chosen step has hours. */
  hours: string | null;
  /** Distinct trades on the chosen steps, as first written, first letter capitalized. */
  trades: string[];
  /** Summed cost share of the chosen steps (or of the Fix now problems), or null when the plan has none. */
  cost: { low: number; high: number } | null;
}

const validHours = (h: WorkStep["hours"]): h is [number, number] =>
  Array.isArray(h) && h.length === 2 && h.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0);

const round = (n: number) => Math.round(n * 10) / 10;

function sumShares(keys: number[], shares: Map<number, CostShare> | null): { low: number; high: number } | null {
  if (!shares || keys.length === 0) return null;
  let low = 0;
  let high = 0;
  for (const k of keys) {
    const s = shares.get(k);
    if (!s) return null;
    low += s.low;
    high += s.high;
  }
  return { low: Math.round(low), high: Math.round(high) };
}

/**
 * Null when there is nothing to single out: no Fix now problem, no step fixing one, or the first steps
 * would be the whole plan anyway.
 */
export function fixFirst(
  issues: readonly Issue[],
  workOrder: readonly WorkStep[],
  costs: { steps?: Map<number, CostShare> | null; issues?: Map<number, CostShare> | null } = {},
): FixFirst | null {
  const ranks = issues.filter((i) => !i.watch && issueTier(i) === "urgent").map((i) => i.rank);
  if (ranks.length === 0) return null;
  const urgent = new Set(ranks);
  const byOrder = new Map<number, WorkStep>();
  for (const s of workOrder) if (Number.isInteger(s.order) && !byOrder.has(s.order)) byOrder.set(s.order, s);

  const fixing = new Set<number>();
  const covered = new Set<number>();
  for (const s of byOrder.values()) {
    for (const r of Array.isArray(s.fixes) ? s.fixes : []) {
      if (urgent.has(r)) {
        fixing.add(s.order);
        covered.add(r);
      }
    }
  }
  if (fixing.size === 0) return null;

  // Walk dependsOn back from each fixing step; a step may only wait on an earlier one, which also stops loops.
  const chosen = new Set(fixing);
  const prerequisites = new Set<number>();
  for (const start of fixing) {
    let cur = byOrder.get(start);
    while (cur && typeof cur.dependsOn === "number" && cur.dependsOn < cur.order) {
      const dep = byOrder.get(cur.dependsOn);
      if (!dep || chosen.has(dep.order)) break;
      chosen.add(dep.order);
      prerequisites.add(dep.order);
      cur = dep;
    }
  }
  const totalSteps = byOrder.size;
  if (chosen.size >= totalSteps) return null;

  const steps = [...chosen].sort((a, b) => a - b);
  let lo = 0;
  let hi = 0;
  let any = false;
  let missing = false;
  const trades = new Map<string, string>();
  for (const o of steps) {
    const s = byOrder.get(o)!;
    if (validHours(s.hours)) {
      lo += Math.min(...s.hours);
      hi += Math.max(...s.hours);
      any = true;
    } else missing = true;
    const t = s.trade?.trim().replace(/\s+/g, " ");
    if (t && !trades.has(t.toLowerCase())) trades.set(t.toLowerCase(), t.charAt(0).toUpperCase() + t.slice(1));
  }

  return {
    ranks,
    unplanned: ranks.filter((r) => !covered.has(r)),
    steps,
    prerequisites: [...prerequisites].sort((a, b) => a - b),
    totalSteps,
    hours: hoursLabel(any ? [round(lo), round(hi)] : null, any && missing),
    trades: [...trades.values()],
    cost: sumShares(steps, costs.steps ?? null) ?? sumShares(ranks, costs.issues ?? null),
  };
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** "about $120–$300" or "about $40". */
export function fixFirstCostLabel(c: { low: number; high: number }): string {
  return c.low === c.high ? `about ${usd(c.low)}` : `about ${usd(c.low)}–${usd(c.high)}`;
}

/** One plain sentence for share text and screen readers. */
export function fixFirstLine(f: FixFirst): string {
  const n = f.ranks.length;
  const probs = n === 1 ? "the 1 Fix now problem" : `the ${n} Fix now problems`;
  const list = f.steps.length === 1 ? `step ${f.steps[0]}` : `steps ${f.steps.slice(0, -1).join(", ")} and ${f.steps[f.steps.length - 1]}`;
  const parts = [`Start here: ${list} of ${f.totalSteps} ${f.steps.length === 1 ? "takes" : "take"} care of ${probs}`];
  const extra: string[] = [];
  if (f.hours) extra.push(`${f.hours} of work`);
  if (f.cost) extra.push(`${fixFirstCostLabel(f.cost)} of the estimate`);
  return `${parts[0]}${extra.length ? `, ${extra.join(" and ")}` : ""}.`;
}
