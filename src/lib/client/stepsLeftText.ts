import type { WorkPlan, WorkStep } from "@/lib/types";
import { hoursLeft, hoursLeftLine } from "./crewSummary";
import { SHARE_SIGNOFF } from "./planText";
import { stepWhoLabel } from "./stepText";

/**
 * "Send the N steps left" on the work steps: once some steps are ticked off, one tap hands whoever picks the work up
 * next just the steps still to do, in order, with who does each, rough hours and what each fixes.
 *
 *   Hope City sanctuary: 3 of 8 steps left
 *   About 4–7 h of work left on the 3 steps not ticked yet.
 *
 *   Step 3: Tape down stage cables (Volunteer, about 1-2 h)
 *     Fixes #2 Loose cable across the stage edge
 *   ...
 *   Done: steps 1, 2, 4, 5, 6.
 */

type LeftPlan = Pick<WorkPlan, "spaceName" | "issues" | "workOrder">;

const oneLine = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();
const validHours = (h: WorkStep["hours"]): h is [number, number] =>
  Array.isArray(h) && Number.isFinite(h[0]) && Number.isFinite(h[1]) && h[0] >= 0 && h[1] >= h[0];

/** The steps not ticked yet, in work order. */
export function stepsLeft(plan: Pick<WorkPlan, "workOrder">, done: readonly number[]): WorkStep[] {
  const ticked = new Set(done);
  return (plan.workOrder ?? []).filter((s) => !ticked.has(s.order));
}

/** Whether the button is worth showing: at least one step is ticked and at least one is left. */
export function canSendStepsLeft(plan: Pick<WorkPlan, "workOrder">, done: readonly number[]): boolean {
  const steps = plan.workOrder ?? [];
  const orders = new Set(steps.map((s) => s.order));
  const anyDone = done.some((n) => orders.has(n));
  return anyDone && stepsLeft(plan, done).length > 0;
}

/** Button text: "Send the last step" or "Send the 3 steps left". */
export function sendStepsLeftLabel(left: number): string {
  return left === 1 ? "Send the last step" : `Send the ${left} steps left`;
}

/** Share sheet title: "Sanctuary stage: 3 steps left". */
export function stepsLeftTitle(plan: Pick<WorkPlan, "spaceName">, left: number): string {
  const space = oneLine(plan.spaceName) || "Work plan";
  return `${space}: ${left === 1 ? "1 step left" : `${left} steps left`}`;
}

export function stepsLeftText(plan: LeftPlan, done: readonly number[], opts: { sample?: boolean } = {}): string {
  const steps = plan.workOrder ?? [];
  const left = stepsLeft(plan, done);
  const lines: string[] = [];
  if (opts.sample) lines.push("Example plan, not a real inspection.");
  const space = oneLine(plan.spaceName) || "Work plan";
  lines.push(`${space}: ${left.length} of ${steps.length} ${steps.length === 1 ? "step" : "steps"} left`);
  const hrs = hoursLeftLine(hoursLeft(steps, done));
  if (hrs) lines.push(hrs);
  lines.push("");

  const issueTitle = new Map((plan.issues ?? []).map((i) => [i.rank, oneLine(i.title)]));
  for (const step of left) {
    const who = stepWhoLabel(step.trade);
    const notes: string[] = [];
    if (who) notes.push(who);
    if (validHours(step.hours)) {
      const [lo, hi] = step.hours;
      notes.push(`about ${lo === hi ? lo : `${lo}-${hi}`} h`);
    }
    lines.push(`Step ${step.order}: ${oneLine(step.title)}${notes.length ? ` (${notes.join(", ")})` : ""}`);
    const fixes = [...new Set(step.fixes ?? [])].filter((r) => issueTitle.has(r));
    if (fixes.length) lines.push(`  Fixes ${fixes.map((r) => `#${r} ${issueTitle.get(r)}`).join("; ")}`);
  }

  const orders = new Set(steps.map((s) => s.order));
  const finished = [...new Set(done)].filter((n) => orders.has(n)).sort((a, b) => a - b);
  if (finished.length) {
    lines.push("");
    lines.push(finished.length === 1 ? `Done: step ${finished[0]}.` : `Done: steps ${finished.join(", ")}.`);
  }
  lines.push("", SHARE_SIGNOFF);
  return lines.join("\n");
}
