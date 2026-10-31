/**
 * One plain line for what the model calls behind a real plan cost, read from plan.meta.costUsd
 * (the server's usage total for the plan run). null for samples, examples, and plans without a usable total,
 * so nothing is shown rather than a made-up number.
 */
import type { WorkPlan } from "../types";

export function formatRunCost(usd: number): string {
  if (usd < 0.01) return "less than 1 cent";
  const cents = Math.round(usd * 100);
  if (cents < 100) return `about ${cents} cents`;
  return `about $${(cents / 100).toFixed(2)}`;
}

export function runCostLine(plan: WorkPlan, opts: { sample?: boolean } = {}): string | null {
  if (opts.sample || plan.meta?.isExample) return null;
  const usd = plan.meta?.costUsd;
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) return null;
  return `The AI model calls for this plan cost ${formatRunCost(usd)}.`;
}
