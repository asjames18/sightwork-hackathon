import type { CostRange, WorkPlan } from "@/lib/types";
import { displayedTotal, issueCostShares, shareLabel, stepCostShares } from "@/lib/costShares";
import { livePricesLine, SHARE_SIGNOFF } from "./planText";

/**
 * The cost card as plain text, for whoever approves the spend (a board, a pastor, a facilities budget), sent by
 * share sheet or clipboard without the whole plan. Same numbers as the card: the displayed total, and the
 * biggest problem or step shares when the plan has shares that add up.
 *
 *   Cost range · Hope City sanctuary
 *   $1,200–$2,400 for Sebring, FL
 *   Rough estimate, not a quote. Labor: volunteer.
 *   All 6 material prices looked up live on the web for Sebring, FL.
 *   Biggest steps:
 *   - Step 2, Mount and tie off stage cables: $400–900
 *   - ...
 *   Assumes:
 *   - Mid-grade materials
 *   Get quotes before you commit to the spend.
 */
export interface CostTextOptions {
  /** Example or sample plan: say so, so a forwarded example is never read as a real price. */
  sample?: boolean;
}

/** How many problem or step shares the text lists; the rest are summed into one "everything else" line. */
export const MAX_COST_LINES = 3;
/** How many assumptions the text lists. */
export const MAX_COST_ASSUMPTIONS = 3;

const oneLine = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const LABOR: Record<CostRange["laborBasis"], string> = {
  volunteer: "volunteer",
  contractor: "contractor",
  mixed: "volunteer and contractor",
};

export function costShareTitle(spaceName?: string): string {
  const space = oneLine(spaceName);
  return space ? `Cost range: ${space}` : "Cost range";
}

interface Row {
  label: string;
  low: number;
  high: number;
}

/** Step shares first (that's what gets scheduled and paid), else problem shares; biggest high end first. */
function shareRows(plan: Pick<WorkPlan, "costRange" | "issues" | "workOrder">): { heading: string; rows: Row[] } | null {
  const steps = stepCostShares(plan);
  if (steps && steps.size > 0) {
    const rows = plan.workOrder
      .filter((s) => steps.has(s.order))
      .map((s) => ({ label: `Step ${s.order}, ${oneLine(s.title)}`, low: steps.get(s.order)!.low, high: steps.get(s.order)!.high }));
    return { heading: "Biggest steps:", rows };
  }
  const issues = issueCostShares(plan);
  if (issues && issues.size > 0) {
    const rows = plan.issues
      .filter((i) => issues.has(i.rank))
      .map((i) => ({ label: `#${i.rank} ${oneLine(i.title)}`, low: issues.get(i.rank)!.low, high: issues.get(i.rank)!.high }));
    return { heading: "Biggest problems:", rows };
  }
  return null;
}

/** Null when the plan has no cost range. */
export function costToText(plan: Pick<WorkPlan, "costRange" | "issues" | "workOrder" | "spaceName">, opts: CostTextOptions = {}): string | null {
  const c = plan.costRange;
  if (!c) return null;
  const total = displayedTotal(c);
  const lines: string[] = [];
  if (opts.sample) lines.push("Example plan, not a real price.");
  const space = oneLine(plan.spaceName);
  lines.push(space ? `Cost range · ${space}` : "Cost range");
  const region = oneLine(c.region);
  const range = total.low === total.high ? usd(total.low) : `${usd(total.low)}–${usd(total.high)}`;
  lines.push(region ? `${range} for ${region}` : range);
  lines.push(`${c.label}. Labor: ${LABOR[c.laborBasis] ?? oneLine(String(c.laborBasis))}.`);
  const live = livePricesLine(c);
  if (live) lines.push(live);

  const shares = shareRows(plan);
  if (shares && shares.rows.length > 1) {
    const sorted = [...shares.rows].sort((a, b) => b.high - a.high || b.low - a.low);
    const shown = sorted.slice(0, MAX_COST_LINES);
    const rest = sorted.slice(MAX_COST_LINES);
    lines.push(shares.heading);
    for (const r of shown) lines.push(`- ${r.label}: ${shareLabel(r)}`);
    if (rest.length > 0) {
      const sum = rest.reduce((a, r) => ({ low: a.low + r.low, high: a.high + r.high }), { low: 0, high: 0 });
      lines.push(`- ${rest.length} more: ${shareLabel(sum)}`);
    }
  }

  const assumptions = (c.assumptions ?? []).map(oneLine).filter(Boolean);
  if (assumptions.length > 0) {
    lines.push("Assumes:");
    for (const a of assumptions.slice(0, MAX_COST_ASSUMPTIONS)) lines.push(`- ${a}`);
  }
  lines.push("Get quotes before you commit to the spend.");
  lines.push("", SHARE_SIGNOFF);
  return lines.join("\n");
}
