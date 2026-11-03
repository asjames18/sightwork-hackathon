import type { WorkPlan, WorkStep } from "@/lib/types";
import { crewSizeLine, hoursLabel, type CrewRow } from "./crewSummary";
import { MAX_SHARE_CHARS, planLocation, shareDate } from "./planText";

/** Sign-off for the call for help: a full link, so people who get it in a group text can tap through. */
export const VOLUNTEER_SIGNOFF = "Made with SightWork \u00B7 https://sightwork.melanatedintech.com";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const span = (r: [number, number]) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`);
const validHours = (h: WorkStep["hours"]): h is [number, number] =>
  Array.isArray(h) && Number.isFinite(h[0]) && Number.isFinite(h[1]) && h[0] >= 0 && h[1] >= 0;

export interface VolunteerCallOptions {
  maxChars?: number;
  sample?: boolean;
  /** Date shown in the header. Default: now. */
  date?: Date;
}

/** Share-sheet title for the call for help. */
export function volunteerCallTitle(plan: Pick<WorkPlan, "spaceName">): string {
  return `Volunteers needed: ${clean(plan.spaceName) || "Work day"}`;
}

/** How many people to picture sharing the work, by the size of the job (midpoint of the hour range). */
function pictureCrew(hours: [number, number]): number {
  const mid = (hours[0] + hours[1]) / 2;
  return mid <= 4 ? 2 : mid <= 12 ? 3 : 4;
}

/**
 * A short, plain call for help to put in a group text or a church announcement: what needs doing, how much
 * work it is, what to bring or buy, and which steps wait on a paid trade. It is built only from the
 * volunteer steps of the plan (the "Volunteers" row of Who does the work); nothing is invented, and no
 * date is promised: the reader is asked to say which days work. Null when the plan has no volunteer steps.
 */
export function volunteerCallText(
  plan: WorkPlan,
  crew: Pick<CrewRow, "paid" | "steps" | "hours" | "hoursPartial">,
  opts: VolunteerCallOptions = {},
): string | null {
  if (crew.paid) return null;
  const byOrder = new Map(plan.workOrder.map((s) => [s.order, s]));
  const ours = crew.steps.map((n) => byOrder.get(n)).filter((s): s is WorkStep => Boolean(s));
  if (ours.length === 0) return null;
  const mine = new Set(ours.map((s) => s.order));
  const maxChars = opts.maxChars ?? MAX_SHARE_CHARS;
  const sample = opts.sample ?? plan.meta?.isExample === true;
  const known = new Set(plan.issues.map((i) => i.rank));
  const fixed = new Set<number>();
  for (const s of ours) for (const r of s.fixes ?? []) if (known.has(r)) fixed.add(r);

  const lines: string[] = [];
  lines.push(`Volunteers needed: ${clean(plan.spaceName) || "work day"}`);
  lines.push([planLocation(plan), shareDate(opts.date ?? new Date())].filter(Boolean).join(" · "));
  if (sample) lines.push("Example plan with sample data, not a real run.");
  const what = fixed.size === 1 ? "1 problem" : `${fixed.size} problems`;
  lines.push(
    "",
    fixed.size > 0
      ? `We are fixing ${what} here and could use your help.`
      : `We have ${ours.length === 1 ? "1 job" : `${ours.length} jobs`} to get done here and could use your help.`,
  );

  const hrs = hoursLabel(crew.hours, crew.hoursPartial);
  lines.push("", `What volunteers will do${hrs ? ` (${hrs} of work in all)` : ""}:`);
  for (const s of ours) lines.push(`- ${clean(s.title)}${validHours(s.hours) ? ` (${span(s.hours)} h)` : ""}`);

  if (crew.hours && !crew.hoursPartial) {
    const n = pictureCrew(crew.hours);
    const each = crewSizeLine(crew.hours, false, n)?.replace(/^\d+ people?: /, "");
    if (each) lines.push("", `Shared between ${n} people, that is ${each.replace(/\.$/, "")}.`);
  }

  const waits = ours.flatMap((s) => {
    const dep = s.dependsOn != null ? byOrder.get(s.dependsOn) : undefined;
    return dep && !mine.has(dep.order) && dep.trade?.trim() ? [{ step: s, dep }] : [];
  });
  if (waits.length > 0) lines.push("");
  for (const { step, dep } of waits) {
    lines.push(`"${clean(step.title)}" starts once the ${clean(dep.trade ?? "")} finishes "${clean(dep.title)}".`);
  }

  const supplies = plan.materials.filter((m) => (m.forIssues ?? []).some((r) => fixed.has(r)));
  if (supplies.length > 0) {
    lines.push("", "Supplies we will need:");
    for (const m of supplies) lines.push(`- ${clean(m.item)}: ${clean(m.qty)}`);
  }

  lines.push("", "Reply if you can help, and tell us which days work for you.", "", VOLUNTEER_SIGNOFF);

  const text = lines.join("\n");
  if (text.length <= maxChars) return text;
  const tail = `\n...\nShortened for a text.\n\n${VOLUNTEER_SIGNOFF}`;
  const body = lines.slice(0, -2).join("\n");
  const cut = body.slice(0, Math.max(0, maxChars - tail.length));
  const atLine = cut.lastIndexOf("\n");
  return (atLine > 0 ? cut.slice(0, atLine) : cut) + tail;
}
