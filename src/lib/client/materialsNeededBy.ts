/**
 * "Needed by": for each material, the first work step that fixes one of the problems it is for, and when that
 * step starts on the same weekday 9-to-5 schedule as Add to calendar. Lets whoever does the buying get things
 * in the order the crew will use them. Client-only, no network.
 */
import type { WorkPlan } from "@/lib/types";
import { scheduleSteps } from "./stepCalendar";

export interface NeededBy {
  /** Order of the earliest step that needs this material. */
  step: number;
  /** Start of that step on the plan schedule. */
  start: Date;
}

type PlanParts = Pick<WorkPlan, "materials" | "workOrder">;

/** One entry per material, same index as plan.materials; null when no step fixes any of its problems. */
export function materialsNeededBy(plan: PlanParts, now: Date = new Date()): (NeededBy | null)[] {
  const steps = plan.workOrder ?? [];
  const starts = new Map<number, Date>();
  for (const b of scheduleSteps(steps, now)) if (!starts.has(b.order)) starts.set(b.order, b.start);
  const firstStepFor = new Map<number, number>();
  for (const s of steps) {
    for (const rank of s.fixes ?? []) {
      const seen = firstStepFor.get(rank);
      if (seen === undefined || s.order < seen) firstStepFor.set(rank, s.order);
    }
  }
  return (plan.materials ?? []).map((m) => {
    let best: number | null = null;
    for (const rank of m.forIssues ?? []) {
      const order = firstStepFor.get(rank);
      if (order !== undefined && (best === null || order < best)) best = order;
    }
    const start = best === null ? undefined : starts.get(best);
    return best === null || !start ? null : { step: best, start };
  });
}

const pad = (n: number) => String(n).padStart(2, "0");
const hourLabel = (d: Date) => {
  const h = d.getHours() % 12 || 12;
  return `${h}${d.getMinutes() ? `:${pad(d.getMinutes())}` : ""} ${d.getHours() < 12 ? "AM" : "PM"}`;
};
const dayLabel = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** "Needed by step 2, Mon, Nov 2, 1 PM", or "" when the material isn't tied to a step. */
export function neededByLine(n: NeededBy | null): string {
  return n ? `Needed by step ${n.step}, ${dayLabel(n.start)}, ${hourLabel(n.start)}` : "";
}

/**
 * Summary above the list: when the first still-needed material has to be on site.
 * "Get these by Mon, Nov 2, 9 AM for step 1." Empty when nothing still needed is tied to a step.
 */
export function firstNeededLine(needed: readonly (NeededBy | null)[], got: readonly number[] = []): string {
  const have = new Set(got);
  let first: NeededBy | null = null;
  let count = 0;
  needed.forEach((n, i) => {
    if (!n || have.has(i)) return;
    if (!first || n.start.getTime() < first.start.getTime()) {
      first = n;
      count = 1;
    } else if (n.start.getTime() === first.start.getTime()) count += 1;
  });
  if (!first) return "";
  const f: NeededBy = first;
  const what = count === 1 ? "1 item" : `${count} items`;
  return `Buy first: ${what} for step ${f.step}, which starts ${dayLabel(f.start)}, ${hourLabel(f.start)}.`;
}
