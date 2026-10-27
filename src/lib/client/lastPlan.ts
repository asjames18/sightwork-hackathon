import type { WorkPlan } from "@/lib/types";

/**
 * Keeps the most recent plan on this device, so a reload (or a dropped tab mid-demo) doesn't
 * lose a real run, and `?view=last` can reopen it without paying for another one.
 * Browser only. Storage can be full or blocked (private mode), so every call fails quietly.
 */
const KEY = "sightwork:lastPlan:v1";

export type SavedPlan = { plan: WorkPlan; videoName: string | null; savedAt: string };

export function saveLastPlan(plan: WorkPlan, videoName: string | null): boolean {
  try {
    const saved: SavedPlan = { plan, videoName, savedAt: new Date().toISOString() };
    window.localStorage.setItem(KEY, JSON.stringify(saved));
    return true;
  } catch {
    // Too big for storage (frames are inline images) or storage is off. Drop any stale copy.
    try {
      window.localStorage.removeItem(KEY);
    } catch {}
    return false;
  }
}

export function loadLastPlan(): SavedPlan | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedPlan;
    return saved?.plan && Array.isArray(saved.plan.issues) ? saved : null;
  } catch {
    return null;
  }
}
