import type { WorkPlan, WorkStep } from "@/lib/types";
import { isVolunteerTrade } from "./crewSummary";
import { SHARE_SIGNOFF } from "./planText";
import { stepWhen } from "./stepCalendar";

/**
 * One work step as plain text, for handing a single step to a single person (a volunteer, a trade) by share sheet
 * or clipboard. Same words as the work order on screen and the crew handout, so nothing reads differently.
 *
 *   Step 3 of 8 · Volunteer
 *   Tape down stage cables
 *   When: Mon, Nov 2, 1 PM to 3 PM
 *   About 1-2 h
 *   <detail>
 *   Fixes: #2 Loose cable across the stage edge
 *   Wait for step 2 (Clear the stage) to finish first.
 *   Bring:
 *   - Gaffer tape: 2 rolls
 *   Space: Hope City sanctuary
 */
export interface StepTextOptions {
  /** Example or sample plan: say so, so a forwarded example is never mistaken for a real inspection. */
  sample?: boolean;
  /** When set, a "When:" line from the plan's starting schedule, the same times as the "Add to calendar" file. */
  scheduleFrom?: Date;
}

type StepPlan = Pick<WorkPlan, "spaceName" | "issues" | "materials" | "workOrder">;

const oneLine = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();
const validHours = (h: WorkStep["hours"]): h is [number, number] =>
  Array.isArray(h) && Number.isFinite(h[0]) && Number.isFinite(h[1]) && h[0] >= 0 && h[1] >= h[0];

export function stepShareTitle(step: Pick<WorkStep, "order" | "title">): string {
  return `Step ${step.order}: ${oneLine(step.title)}`;
}

/** "Volunteer", "Paid: Electrician", or null when the step names no trade. */
export function stepWhoLabel(trade: string | undefined): string | null {
  const t = oneLine(trade);
  if (!t) return null;
  return isVolunteerTrade(t) ? "Volunteer" : `Paid: ${t}`;
}

export function stepToText(plan: StepPlan, step: WorkStep, opts: StepTextOptions = {}): string {
  const steps = plan.workOrder ?? [];
  const lines: string[] = [];
  if (opts.sample) lines.push("Example plan, not a real inspection.");
  const who = stepWhoLabel(step.trade);
  lines.push(`Step ${step.order} of ${steps.length}${who ? ` · ${who}` : ""}`);
  lines.push(oneLine(step.title));
  const when = opts.scheduleFrom ? stepWhen(steps, opts.scheduleFrom).get(step.order) : undefined;
  if (when) lines.push(`When: ${when}`);
  if (validHours(step.hours)) {
    const [lo, hi] = step.hours;
    lines.push(`About ${lo === hi ? lo : `${lo}-${hi}`} h`);
  }
  const detail = oneLine(step.detail);
  if (detail && detail !== oneLine(step.title)) lines.push(detail);

  const issueTitle = new Map((plan.issues ?? []).map((i) => [i.rank, oneLine(i.title)]));
  const fixes = [...new Set(step.fixes ?? [])].filter((r) => issueTitle.has(r));
  if (fixes.length) lines.push(`Fixes: ${fixes.map((r) => `#${r} ${issueTitle.get(r)}`).join("; ")}`);

  const dep = step.dependsOn != null ? steps.find((s) => s.order === step.dependsOn) : undefined;
  if (dep && dep.order !== step.order) lines.push(`Wait for step ${dep.order} (${oneLine(dep.title)}) to finish first.`);

  const fixing = new Set(fixes);
  const materials = (plan.materials ?? []).filter((m) => (m.forIssues ?? []).some((r) => fixing.has(r)));
  if (materials.length) {
    lines.push("Bring:");
    for (const m of materials) {
      const qty = oneLine(m.qty);
      lines.push(`- ${oneLine(m.item)}${qty ? `: ${qty}` : ""}`);
    }
  }
  const space = oneLine(plan.spaceName);
  if (space) lines.push(`Space: ${space}`);
  lines.push("", SHARE_SIGNOFF);
  return lines.join("\n");
}
