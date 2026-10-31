import type { WorkPlan, WorkStep } from "@/lib/types";
import { hoursLabel, stepsLabel, type CrewRow } from "./crewSummary";
import { MAX_SHARE_CHARS, SHARE_SIGNOFF, planLocation, shareDate } from "./planText";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const span = (r: [number, number]) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`);
const validHours = (h: WorkStep["hours"]): h is [number, number] =>
  Array.isArray(h) && Number.isFinite(h[0]) && Number.isFinite(h[1]) && h[0] >= 0 && h[1] >= 0;

export interface CrewHandoutOptions {
  maxChars?: number;
  sample?: boolean;
  /** Date shown in the header. Default: now. */
  date?: Date;
}

/** Share-sheet title for one crew's handout. */
export function crewHandoutTitle(plan: Pick<WorkPlan, "spaceName">, crew: Pick<CrewRow, "label">): string {
  return `${crew.label}: ${clean(plan.spaceName) || "Walkthrough"}`;
}

/**
 * Just one crew's part of the plan, as plain text for a group text or email to that crew: their steps in the
 * plan's order with what each fixes, how long, and which other step has to finish first, then the materials for
 * the problems their steps fix. Everything comes from the plan; nothing is invented, and other crews' steps are
 * only named when one of ours waits on them.
 */
export function crewHandoutText(plan: WorkPlan, crew: Pick<CrewRow, "label" | "paid" | "steps" | "hours" | "hoursPartial">, opts: CrewHandoutOptions = {}): string {
  const maxChars = opts.maxChars ?? MAX_SHARE_CHARS;
  const sample = opts.sample ?? plan.meta?.isExample === true;
  const byOrder = new Map(plan.workOrder.map((s) => [s.order, s]));
  const ours = crew.steps.map((n) => byOrder.get(n)).filter((s): s is WorkStep => Boolean(s));
  const mine = new Set(ours.map((s) => s.order));
  const issueTitle = new Map(plan.issues.map((i) => [i.rank, clean(i.title)]));
  const lines: string[] = [];

  lines.push(`${crew.label}: your part of the work plan for ${clean(plan.spaceName) || "this space"}`);
  lines.push([planLocation(plan), shareDate(opts.date ?? new Date())].filter(Boolean).join(" · "));
  const hrs = hoursLabel(crew.hours, crew.hoursPartial);
  const count = ours.length === 1 ? "1 step" : `${ours.length} steps`;
  lines.push(`${count}${hrs ? `, ${hrs} of work` : ""}${crew.paid ? "" : ", volunteer work"}.`);
  if (sample) lines.push("Example plan with sample data, not a real run.");

  const fixed = new Set<number>();
  lines.push("", "Your steps, in the plan's order:");
  for (const s of ours) {
    lines.push(`Step ${s.order}. ${clean(s.title)}${validHours(s.hours) ? ` (${span(s.hours)} h)` : ""}`);
    if (s.detail?.trim()) lines.push(`   ${clean(s.detail)}`);
    const fixes = (s.fixes ?? []).filter((r) => issueTitle.has(r));
    for (const r of fixes) fixed.add(r);
    if (fixes.length) lines.push(`   Fixes: ${fixes.map((r) => `#${r} ${issueTitle.get(r)}`).join("; ")}`);
    const dep = s.dependsOn != null ? byOrder.get(s.dependsOn) : undefined;
    if (dep) {
      const who = mine.has(dep.order) ? "" : dep.trade?.trim() ? `, ${clean(dep.trade)}` : "";
      lines.push(`   Wait for step ${dep.order} (${clean(dep.title)}${who}) to finish first.`);
    }
  }

  const materials = plan.materials.filter((m) => (m.forIssues ?? []).some((r) => fixed.has(r)));
  if (materials.length > 0) {
    lines.push("", "Materials for these steps:");
    for (const m of materials) lines.push(`- ${clean(m.item)}: ${clean(m.qty)}`);
  }

  const total = plan.workOrder.length;
  if (total > ours.length) lines.push("", `The full plan has ${total} steps; this list is ${stepsLabel(crew.steps).replace(/^Step/, "step")} only.`);
  lines.push("", SHARE_SIGNOFF);

  const text = lines.join("\n");
  if (text.length <= maxChars) return text;
  const tail = `\n...\nShortened for a text.\n\n${SHARE_SIGNOFF}`;
  const body = lines.slice(0, -2).join("\n");
  const cut = body.slice(0, Math.max(0, maxChars - tail.length));
  const atLine = cut.lastIndexOf("\n");
  return (atLine > 0 ? cut.slice(0, atLine) : cut) + tail;
}
