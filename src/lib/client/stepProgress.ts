import type { WorkPlan } from "@/lib/types";

/**
 * Work-step checklist progress, kept on this device per plan so a crew lead can tick steps off
 * on a phone and come back later. Browser only; storage can be full or off, so every call fails quietly.
 */
const PREFIX = "sightwork:steps:v1:";
/** Fired on window after the ticks for a plan change, so every part of the plan screen stays in step. */
export const STEPS_CHANGED_EVENT = "sightwork:steps-changed";
/** Oldest entries are dropped past this many plans, so storage never grows without bound. */
const MAX_PLANS = 20;

/** Stable key for a plan: its name plus its step titles in order (FNV-1a hash), so a new run gets a fresh list. */
export function planStepsKey(plan: Pick<WorkPlan, "spaceName" | "workOrder">): string {
  const src = [plan.spaceName, ...plan.workOrder.map((s) => `${s.order}:${s.title}`)].join("\u0001");
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return PREFIX + h.toString(36);
}

type Stored = { done: number[]; at: number };

/** Step orders ticked off for this plan, limited to steps that still exist. */
export function loadDoneSteps(plan: Pick<WorkPlan, "spaceName" | "workOrder">): number[] {
  try {
    const raw = window.localStorage.getItem(planStepsKey(plan));
    if (!raw) return [];
    const saved = JSON.parse(raw) as Stored;
    if (!saved || !Array.isArray(saved.done)) return [];
    const valid = new Set(plan.workOrder.map((s) => s.order));
    return [...new Set(saved.done.filter((n) => typeof n === "number" && valid.has(n)))].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/** Saves the ticked steps; an empty list removes the entry. Returns false when storage refused it. */
export function saveDoneSteps(plan: Pick<WorkPlan, "spaceName" | "workOrder">, done: number[]): boolean {
  const key = planStepsKey(plan);
  try {
    const ls = window.localStorage;
    if (done.length === 0) {
      ls.removeItem(key);
      notify(key);
      return true;
    }
    const value: Stored = { done: [...new Set(done)].sort((a, b) => a - b), at: Date.now() };
    ls.setItem(key, JSON.stringify(value));
    prune(ls);
    notify(key);
    return true;
  } catch {
    return false;
  }
}

function notify(key: string) {
  try {
    window.dispatchEvent(new CustomEvent(STEPS_CHANGED_EVENT, { detail: { key } }));
  } catch {}
}

function prune(ls: Storage) {
  if (typeof ls.length !== "number" || typeof ls.key !== "function") return;
  const entries: { key: string; at: number }[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    let at = 0;
    try {
      at = Number((JSON.parse(ls.getItem(k) ?? "{}") as Stored).at) || 0;
    } catch {}
    entries.push({ key: k, at });
  }
  if (entries.length <= MAX_PLANS) return;
  entries.sort((a, b) => a.at - b.at);
  for (const e of entries.slice(0, entries.length - MAX_PLANS)) ls.removeItem(e.key);
}

/** "2 of 5 steps done", "All 5 steps done", or "" when nothing is ticked. */
export function progressLine(done: number, total: number): string {
  if (total === 0 || done === 0) return "";
  if (done >= total) return total === 1 ? "The step is done." : `All ${total} steps done.`;
  return `${done} of ${total} step${total === 1 ? "" : "s"} done.`;
}

/** Ticked steps limited to the given step orders, sorted, no repeats. */
function doneAmong(steps: readonly number[], done: readonly number[]): number[] {
  const want = new Set(steps);
  return [...new Set(done.filter((n) => want.has(n)))].sort((a, b) => a - b);
}

/** Progress on a few chosen steps (the Start here card): "1 of 3 done.", "All 3 done.", or "" when none are ticked. */
export function subsetProgressLine(steps: readonly number[], done: readonly number[]): string {
  const total = new Set(steps).size;
  const n = doneAmong(steps, done).length;
  if (total === 0 || n === 0) return "";
  if (n >= total) return total === 1 ? "Done." : `All ${total} done.`;
  return `${n} of ${total} done.`;
}

/** True when every step that fixes a problem is ticked off. */
export function allStepsDone(orders: readonly number[], done: readonly number[]): boolean {
  return orders.length > 0 && orders.every((o) => done.includes(o));
}

const stepList = (orders: number[]) =>
  orders.length === 1 ? `step ${orders[0]}` : `steps ${orders.slice(0, -1).join(", ")} and ${orders[orders.length - 1]}`;

/** Line for the shared text: which steps are already ticked off, or null when none are. */
export function shareProgressLine(workOrder: readonly { order: number }[], done: readonly number[]): string | null {
  const orders = workOrder.map((s) => s.order);
  const total = new Set(orders).size;
  const ticked = doneAmong(orders, done);
  if (total === 0 || ticked.length === 0) return null;
  if (ticked.length >= total) return total === 1 ? "Progress: the one step is ticked off as done." : `Progress: all ${total} steps are ticked off as done.`;
  return `Progress: ${ticked.length} of ${total} steps ticked off as done (${stepList(ticked)}).`;
}
