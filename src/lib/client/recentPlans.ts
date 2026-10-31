import type { WorkPlan } from "@/lib/types";
import type { SavedPlan } from "./lastPlan";
import { planLocation } from "./planText";

/**
 * The last few finished real runs kept on this device, so a crew lead who walks three rooms can
 * reopen any of them without paying for another run. "Open my last plan" still covers the newest.
 *
 * Plans carry their frames and after image inline (a few MB each), so the plans themselves go to
 * IndexedDB (same database and store as the big last plan, keys `recent:<id>`), and a small index
 * of what to list goes to localStorage so the list shows at once. Browser only; storage can be
 * full or blocked (private mode), so every call fails quietly. Example plans are never listed.
 */
export const RECENT_INDEX_KEY = "sightwork:recentPlans:v1";
export const RECENT_MAX = 5;
const DB_NAME = "sightwork";
const DB_STORE = "plans";
const CHANGE_EVENT = "sightwork:recent-plans";

export type RecentEntry = {
  id: string;
  spaceName: string;
  /** "City, ST" when the plan carries one. */
  region: string | null;
  savedAt: string;
  problems: number;
  videoName: string | null;
};

/** The few IndexedDB calls this module needs, so tests can swap in a fake. */
export interface RecentPlanStore {
  get(id: string): Promise<unknown>;
  put(id: string, value: SavedPlan): Promise<void>;
  remove(id: string): Promise<void>;
}

let storeOverride: RecentPlanStore | null | undefined;
/** Tests only: replace the IndexedDB store (null = no IndexedDB), or undefined to restore it. */
export function setRecentPlanStoreForTests(store: RecentPlanStore | null | undefined): void {
  storeOverride = store;
}
function store(): RecentPlanStore | null {
  return storeOverride !== undefined ? storeOverride : indexedDbStore();
}

function ls(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isEntry(v: unknown): v is RecentEntry {
  const e = v as RecentEntry | null;
  return Boolean(e && typeof e.id === "string" && e.id && typeof e.savedAt === "string" && typeof e.spaceName === "string");
}

let cachedRaw: string | null | undefined;
let cachedList: RecentEntry[] = [];
const EMPTY: RecentEntry[] = [];

/** The saved list, newest first. Same array back while nothing changed (safe for useSyncExternalStore). */
export function listRecentPlans(): RecentEntry[] {
  let raw: string | null = null;
  try {
    raw = ls()?.getItem(RECENT_INDEX_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cachedList = Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, RECENT_MAX) : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

/** Server render and first client render: nothing saved, so there's no hydration mismatch. */
export function listRecentPlansOnServer(): RecentEntry[] {
  return EMPTY;
}

function writeIndex(list: RecentEntry[]): boolean {
  try {
    const storage = ls();
    if (!storage) return false;
    if (list.length) storage.setItem(RECENT_INDEX_KEY, JSON.stringify(list));
    else storage.removeItem(RECENT_INDEX_KEY);
  } catch {
    return false;
  }
  try {
    window.dispatchEvent?.(new Event(CHANGE_EVENT));
  } catch {}
  return true;
}

/** Re-render when this tab or another one changes the list. */
export function subscribeRecentPlans(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === RECENT_INDEX_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Stable per run: the same plan saved twice (a reload) replaces its row instead of adding one. Every
 * problem title and the run's cost go in, so a second walkthrough of the same room (often the same top
 * problem and count) gets its own row and can be compared with the first.
 */
export function recentPlanId(plan: WorkPlan): string {
  const titles = Array.isArray(plan.issues) ? plan.issues.map((i) => i?.title ?? "").join("~") : "";
  const cost = typeof plan.meta?.costUsd === "number" ? String(plan.meta.costUsd) : "";
  const basis = `${plan.spaceName ?? ""}|${plan.generatedFrom ?? ""}|${plan.issues?.length ?? 0}|${titles}|${plan.meta?.region ?? ""}|${cost}`;
  let h = 5381;
  for (let i = 0; i < basis.length; i++) h = ((h << 5) + h + basis.charCodeAt(i)) >>> 0;
  return `p${h.toString(36)}`;
}

export function entryFor(plan: WorkPlan, videoName: string | null, savedAt: string): RecentEntry {
  return {
    id: recentPlanId(plan),
    spaceName: (plan.spaceName ?? "").trim() || "Walkthrough",
    region: planLocation(plan),
    savedAt,
    problems: Array.isArray(plan.issues) ? plan.issues.length : 0,
    videoName,
  };
}

/**
 * Adds a finished real run at the top of the list (at most RECENT_MAX; the oldest is dropped and
 * its stored copy deleted). Resolves true once the plan is stored. Without IndexedDB nothing is
 * listed, because a row that can't open would be worse than no row.
 */
export async function addRecentPlan(plan: WorkPlan, videoName: string | null, now: Date = new Date()): Promise<boolean> {
  const s = store();
  if (!s || !plan || !Array.isArray(plan.issues)) return false;
  const savedAt = now.toISOString();
  const entry = entryFor(plan, videoName, savedAt);
  try {
    await s.put(entry.id, { plan, videoName, savedAt });
  } catch {
    return false;
  }
  const before = listRecentPlans().filter((e) => e.id !== entry.id);
  const next = [entry, ...before].slice(0, RECENT_MAX);
  const dropped = before.slice(RECENT_MAX - 1);
  if (!writeIndex(next)) return false;
  for (const old of dropped) void s.remove(old.id).catch(() => {});
  return true;
}

/** Removes one row and its stored plan. */
export async function removeRecentPlan(id: string): Promise<void> {
  writeIndex(listRecentPlans().filter((e) => e.id !== id));
  try {
    await store()?.remove(id);
  } catch {}
}

/** The stored plan for a row; a row whose copy is gone or unreadable is dropped from the list. */
export async function openRecentPlan(id: string): Promise<SavedPlan | null> {
  let value: unknown = null;
  try {
    value = (await store()?.get(id)) ?? null;
  } catch {
    value = null;
  }
  const saved = value as SavedPlan | null;
  if (saved?.plan && Array.isArray(saved.plan.issues)) return saved;
  writeIndex(listRecentPlans().filter((e) => e.id !== id));
  return null;
}

/** "Oct 30, 6:12 PM" in the viewer's own time zone. */
export function recentWhen(savedAt: string, locale?: string): string {
  const d = new Date(savedAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale ?? "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function indexedDbStore(): RecentPlanStore | null {
  let idb: IDBFactory | undefined;
  try {
    idb = typeof indexedDB === "undefined" ? undefined : indexedDB;
  } catch {
    idb = undefined;
  }
  if (!idb) return null;
  const factory = idb;
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("IndexedDB blocked"));
    });
  const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, mode);
        const req = fn(tx.objectStore(DB_STORE));
        let result: T;
        req.onsuccess = () => (result = req.result);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB aborted"));
      });
    } finally {
      db.close();
    }
  };
  const key = (id: string) => `recent:${id}`;
  return {
    get: (id) => run("readonly", (s) => s.get(key(id))),
    put: (id, value) => run("readwrite", (s) => s.put(value, key(id))).then(() => undefined),
    remove: (id) => run("readwrite", (s) => s.delete(key(id))).then(() => undefined),
  };
}
