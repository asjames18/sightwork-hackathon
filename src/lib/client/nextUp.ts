import type { WorkStep } from "@/lib/types";
import { isVolunteerTrade } from "./crewSummary";

/**
 * Which work step to do next, from the steps ticked off on this device: the lowest step not done yet whose
 * wait-for step is done (or that waits on nothing). Shown on the plan screen once any step is ticked off,
 * so someone coming back to a plan sees where the work stands without scrolling the whole work order.
 */
export type NextUp =
  | { kind: "all"; total: number }
  | {
      kind: "next";
      /** The step to do next. */
      order: number;
      /** Set when every open step waits on an unfinished step, so the next one is not ready yet. */
      waitingOn: number | null;
      /** Steps ticked off. */
      done: number;
      /** Steps on the plan. */
      total: number;
      /** Other open steps that are also ready to start now. */
      alsoReady: number;
    };

/** Null until at least one step is ticked off (untouched plans look the same) or when there are no steps. */
export function nextUp(workOrder: readonly Pick<WorkStep, "order" | "dependsOn">[], done: readonly number[]): NextUp | null {
  const orders = [...new Set(workOrder.map((s) => s.order).filter((o) => Number.isInteger(o)))].sort((a, b) => a - b);
  if (orders.length === 0) return null;
  const doneSet = new Set(done.filter((o) => orders.includes(o)));
  if (doneSet.size === 0) return null;
  if (doneSet.size >= orders.length) return { kind: "all", total: orders.length };

  const exists = new Set(orders);
  const dependsOn = new Map(workOrder.map((s) => [s.order, s.dependsOn]));
  const open = orders.filter((o) => !doneSet.has(o));
  const isReady = (o: number) => {
    const d = dependsOn.get(o);
    return d == null || d === o || !exists.has(d) || doneSet.has(d);
  };
  const ready = open.filter(isReady);
  if (ready.length > 0) {
    return { kind: "next", order: ready[0], waitingOn: null, done: doneSet.size, total: orders.length, alsoReady: ready.length - 1 };
  }
  // Every open step waits on another open step (a loop in the plan): name the first and what it waits on.
  const first = open[0];
  return { kind: "next", order: first, waitingOn: dependsOn.get(first) ?? null, done: doneSet.size, total: orders.length, alsoReady: 0 };
}

/** "3 of 8 steps done.", or for a finished plan "All 8 steps done." / "The step is done." */
export function nextUpProgress(n: NextUp): string {
  if (n.kind === "all") return n.total === 1 ? "The step is done." : `All ${n.total} steps done.`;
  return `${n.done} of ${n.total} step${n.total === 1 ? "" : "s"} done.`;
}

/** "About 2 h", "About 1-3 h", or null when the step gives no usable hours. */
export function nextUpHours(hours: WorkStep["hours"]): string | null {
  if (!Array.isArray(hours)) return null;
  const [lo, hi] = hours;
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < 0 || hi < lo) return null;
  return `About ${lo === hi ? lo : `${lo}-${hi}`} h`;
}

/** Line under the step when others can start now too: "1 other step can start now too." */
export function alsoReadyLine(n: number): string {
  if (n <= 0) return "";
  return n === 1 ? "1 other step can start now too." : `${n} other steps can start now too.`;
}

/**
 * The "Next up" line for Send to your team and Save PDF, after the progress line, so a teammate reading the
 * text knows where to pick up: "Next up: step 3, Patch the drywall (Volunteer, about 2 h). 1 other step can
 * start now too." When every open step waits on another open step it says which one first. Null on an
 * untouched plan (nothing ticked) and on a finished one (the progress line already says all done).
 */
export function nextUpShareLine(
  workOrder: readonly Pick<WorkStep, "order" | "dependsOn" | "title" | "trade" | "hours">[],
  done: readonly number[],
): string | null {
  const n = nextUp(workOrder, done);
  if (!n || n.kind !== "next") return null;
  const step = workOrder.find((s) => s.order === n.order);
  if (!step) return null;
  const title = (step.title ?? "").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  const trade = (step.trade ?? "").replace(/\s+/g, " ").trim();
  // Same words as the card and the step text ("Volunteer" / "Paid: Electrician"), without importing the text module.
  const who = trade ? (isVolunteerTrade(trade) ? "Volunteer" : `Paid: ${trade}`) : null;
  const hours = nextUpHours(step.hours);
  const facts = [who, hours ? hours.charAt(0).toLowerCase() + hours.slice(1) : null].filter(Boolean).join(", ");
  const head = `Next up: step ${n.order}${title ? `, ${title}` : ""}${facts ? ` (${facts})` : ""}`;
  if (n.waitingOn != null) return `${head}, once step ${n.waitingOn} is done.`;
  const also = alsoReadyLine(n.alsoReady);
  return also ? `${head}. ${also}` : `${head}.`;
}
