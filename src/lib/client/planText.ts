import { COST_LABEL, type WorkPlan } from "@/lib/types";
import { planReview, reviewLine, verdictFor } from "@/lib/review";

/** Longest share text we hand to the share sheet or clipboard; long plans are cut at a line with a pointer to the PDF. */
export const MAX_SHARE_CHARS = 6000;

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const span = (r: [number, number], unit = "") => (r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]}-${r[1]}${unit}`);
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

const SEVERITY: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

/**
 * The plan as plain text, for a group text or email to the people doing the work.
 * Same order as the plan screen: problems worst first, the work steps, materials, then cost.
 * Only sections with content appear, and the cost always carries its "not a quote" label.
 */
export function planToText(plan: WorkPlan, opts: { maxChars?: number; sample?: boolean } = {}): string {
  const maxChars = opts.maxChars ?? MAX_SHARE_CHARS;
  const lines: string[] = [];
  const narrated = Boolean(plan.transcript?.trim()) || (plan.transcriptTurns?.length ?? 0) > 0;
  const sample = opts.sample ?? plan.meta?.isExample === true;

  lines.push(`Work plan: ${clean(plan.spaceName) || "Walkthrough"}`);
  if (sample) lines.push("(Example plan with sample data, not a real run.)");
  if (narrated && plan.transcriptSummary) lines.push(`Asked for: ${clean(plan.transcriptSummary)}`);

  const issues = [...plan.issues].sort((a, b) => a.rank - b.rank);
  const review = planReview(plan);
  if (issues.length > 0) {
    lines.push("", `Problems, worst first (${issues.length}):`);
    for (const [n, i] of issues.entries()) {
      const notSaid = narrated && i.unmentioned ? " [not mentioned]" : "";
      const unverified = verdictFor(review, i)?.verified === false ? " [unverified: no photo backs it]" : "";
      lines.push(`${n + 1}. ${clean(i.title)} (${SEVERITY[i.severity] ?? i.severity})${notSaid}${unverified}`);
    }
    const line = reviewLine(review);
    if (line) lines.push(line);
  } else {
    lines.push("", "No problems found in the frames checked. Walk it in person before you sign off.");
  }

  const steps = [...plan.workOrder].sort((a, b) => a.order - b.order);
  if (steps.length > 0) {
    lines.push("", "Do the work in this order:");
    for (const s of steps) {
      const extra = [s.trade ? clean(s.trade) : null, s.hours ? `${span(s.hours)} h` : null].filter(Boolean).join(", ");
      lines.push(`${s.order}. ${clean(s.title)}${extra ? ` (${extra})` : ""}`);
    }
  }

  if (plan.materials.length > 0) {
    lines.push("", "Materials:");
    for (const m of plan.materials) lines.push(`- ${clean(m.item)}: ${clean(m.qty)}`);
  }

  if (plan.costRange) {
    const c = plan.costRange;
    lines.push("", `Rough cost: ${usd(c.low)}-${usd(c.high)} (${c.label ?? COST_LABEL}, ${clean(c.region)})`);
  }

  lines.push("", "Made with SightWork. Proof photos are in the full plan.");

  const text = lines.join("\n");
  if (text.length <= maxChars) return text;
  const tail = "\n...\nSee the full plan for the rest.";
  const cut = text.slice(0, Math.max(0, maxChars - tail.length));
  const atLine = cut.lastIndexOf("\n");
  return (atLine > 0 ? cut.slice(0, atLine) : cut) + tail;
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/** Minimal slices of `navigator` used here, so tests can pass stubs. */
export interface ShareNavigator {
  share?: (data: { title?: string; text?: string }) => Promise<void>;
  canShare?: (data: { title?: string; text?: string }) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

/**
 * Native share sheet when the device has one (phones), else the clipboard.
 * A dismissed share sheet is "cancelled", not an error, and never falls through to the clipboard.
 */
export async function sharePlanText(title: string, text: string, nav: ShareNavigator, preferShare: boolean): Promise<ShareResult> {
  const data = { title, text };
  if (preferShare && typeof nav.share === "function" && (!nav.canShare || nav.canShare(data))) {
    try {
      await nav.share(data);
      return "shared";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
      // Some browsers refuse share outside a trusted gesture; the clipboard still works.
    }
  }
  if (nav.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
