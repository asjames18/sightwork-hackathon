import type { WorkPlan } from "@/lib/types";

/**
 * Work-step checklist progress, kept on this device per plan so a crew lead can tick steps off
 * on a phone and come back later. Browser only; storage can be full or off, so every call fails quietly.
 */
const PREFIX = "sightwork:steps:v1:";
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
      return true;
    }
    const value: Stored = { done: [...new Set(done)].sort((a, b) => a - b), at: Date.now() };
    ls.setItem(key, JSON.stringify(value));
    prune(ls);
    return true;
  } catch {
    return false;
  }
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
