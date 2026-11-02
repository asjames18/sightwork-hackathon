import type { WatchItem } from "@/lib/planExtras";

/**
 * "Worth a closer look" finds checked in person: kept on this device per plan, so whoever walks the space can
 * tick each lower-confidence find once they've looked at it and come back later. Browser only; storage can be
 * full or off, so every call fails quietly.
 */
const PREFIX = "sightwork:watch-checked:v1:";
/** Oldest entries are dropped past this many plans, so storage never grows without bound. */
const MAX_PLANS = 20;

type WatchPlan = { spaceName?: string; watch: readonly Pick<WatchItem, "title">[] };
type Stored = { checked: number[]; at: number };

/** Stable key for a plan's closer-look list: its name plus the find titles in order (FNV-1a hash). */
export function watchCheckedKey(plan: WatchPlan): string {
  const src = [plan.spaceName ?? "", ...plan.watch.map((w, i) => `${i}:${w.title}`)].join("\u0001");
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return PREFIX + h.toString(36);
}

/** Indexes (into the watch list) already checked, limited to finds that still exist. */
export function loadWatchChecked(plan: WatchPlan): number[] {
  try {
    const raw = window.localStorage.getItem(watchCheckedKey(plan));
    if (!raw) return [];
    const saved = JSON.parse(raw) as Stored;
    if (!saved || !Array.isArray(saved.checked)) return [];
    const n = plan.watch.length;
    return [...new Set(saved.checked.filter((i) => Number.isInteger(i) && i >= 0 && i < n))].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/** Saves the checked finds; an empty list removes the entry. Returns false when storage refused it. */
export function saveWatchChecked(plan: WatchPlan, checked: readonly number[]): boolean {
  const key = watchCheckedKey(plan);
  try {
    const ls = window.localStorage;
    if (checked.length === 0) {
      ls.removeItem(key);
      return true;
    }
    const value: Stored = { checked: [...new Set(checked)].sort((a, b) => a - b), at: Date.now() };
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

/** Adds or removes one find from the checked list, kept sorted. */
export function toggleWatchChecked(checked: readonly number[], index: number): number[] {
  const set = new Set(checked);
  if (set.has(index)) set.delete(index);
  else set.add(index);
  return [...set].sort((a, b) => a - b);
}

/** "1 of 2 checked in person.", "Both checked in person.", "All 3 checked in person.", or "" when none is. */
export function watchCheckedLine(checked: number, total: number): string {
  if (total <= 0 || checked <= 0) return "";
  if (checked >= total) {
    if (total === 1) return "Checked in person.";
    return total === 2 ? "Both checked in person." : `All ${total} checked in person.`;
  }
  return `${checked} of ${total} checked in person.`;
}

/** Toggle wording; the pressed state carries whether it is checked. */
export function watchCheckLabel(checked: boolean): string {
  return checked ? "Checked" : "Mark checked";
}
