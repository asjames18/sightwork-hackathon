import type { WorkPlan } from "@/lib/types";

/**
 * Keeps the most recent plan on this device, so a reload (or a dropped tab mid-demo) doesn't
 * lose a real run, and `?view=last` can reopen it without paying for another one.
 *
 * A real run carries its frames and after image inline, so it can be a few MB: past what
 * localStorage holds on many phones. Small plans go to localStorage (sync, as before); a plan
 * that doesn't fit goes to IndexedDB, with a small marker in localStorage so the page can still
 * tell, without waiting, that a plan is saved. Browser only. Storage can be full or blocked
 * (private mode), so every call fails quietly.
 */
const KEY = "sightwork:lastPlan:v1";
/** Marker for a plan kept in IndexedDB: `{ videoName, savedAt }`, never the plan itself. */
export const BIG_MARKER_KEY = "sightwork:lastPlan:big:v1";
const DB_NAME = "sightwork";
const DB_STORE = "plans";
const DB_RECORD = "last";

export type SavedPlan = { plan: WorkPlan; videoName: string | null; savedAt: string };

/** The few IndexedDB calls this module needs, so tests can swap in a fake. */
export interface BigPlanStore {
  get(): Promise<unknown>;
  put(value: SavedPlan): Promise<void>;
  clear(): Promise<void>;
}

let storeOverride: BigPlanStore | null | undefined;
/** Tests only: replace the IndexedDB store (null = no IndexedDB), or undefined to restore it. */
export function setBigPlanStoreForTests(store: BigPlanStore | null | undefined): void {
  storeOverride = store;
}

function bigStore(): BigPlanStore | null {
  if (storeOverride !== undefined) return storeOverride;
  return indexedDbStore();
}

function isSavedPlan(value: unknown): value is SavedPlan {
  const saved = value as SavedPlan | null;
  return Boolean(saved?.plan && Array.isArray(saved.plan.issues));
}

function ls(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Saves the plan. Returns true when it is already stored: in localStorage, or (for a plan too
 * big for it) once IndexedDB has it. The promise from a big plan is optional to wait on: the
 * marker is written first, so the "Open my last plan" link shows right away.
 */
export function saveLastPlan(plan: WorkPlan, videoName: string | null): boolean | Promise<boolean> {
  const saved: SavedPlan = { plan, videoName, savedAt: new Date().toISOString() };
  const storage = ls();
  try {
    if (!storage) throw new Error("no storage");
    storage.setItem(KEY, JSON.stringify(saved));
    // Fits: drop any older big copy so there is only one "last plan".
    try {
      storage.removeItem(BIG_MARKER_KEY);
    } catch {}
    void bigStore()?.clear().catch(() => {});
    return true;
  } catch {
    // Too big for localStorage (frames are inline images) or it is off. Drop any stale copy.
    try {
      storage?.removeItem(KEY);
    } catch {}
  }
  const store = bigStore();
  if (!store) return false;
  try {
    storage?.setItem(BIG_MARKER_KEY, JSON.stringify({ videoName, savedAt: saved.savedAt }));
  } catch {}
  return store.put(saved).then(
    () => true,
    () => {
      try {
        storage?.removeItem(BIG_MARKER_KEY);
      } catch {}
      return false;
    },
  );
}

/** The plan saved in localStorage, read without waiting. A plan kept in IndexedDB needs loadLastPlanAsync. */
export function loadLastPlan(): SavedPlan | null {
  try {
    const raw = ls()?.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as unknown;
    return isSavedPlan(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** True when a last plan is saved here, in either place. Sync, for links that show at once. */
export function hasLastPlan(): boolean {
  if (loadLastPlan()) return true;
  try {
    return Boolean(ls()?.getItem(BIG_MARKER_KEY));
  } catch {
    return false;
  }
}

/** The last plan from either place. A marker whose IndexedDB copy is gone or unreadable is cleared. */
export async function loadLastPlanAsync(): Promise<SavedPlan | null> {
  const small = loadLastPlan();
  if (small) return small;
  const storage = ls();
  let marked = false;
  try {
    marked = Boolean(storage?.getItem(BIG_MARKER_KEY));
  } catch {}
  if (!marked) return null;
  const store = bigStore();
  let value: unknown = null;
  try {
    value = store ? await store.get() : null;
  } catch {
    value = null;
  }
  if (isSavedPlan(value)) return value;
  try {
    storage?.removeItem(BIG_MARKER_KEY);
    // Let open tabs re-check their "Open my last plan" link.
    window.dispatchEvent?.(new StorageEvent("storage", { key: BIG_MARKER_KEY }));
  } catch {}
  return null;
}

function indexedDbStore(): BigPlanStore | null {
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
  return {
    get: () => run("readonly", (s) => s.get(DB_RECORD)),
    put: (value) => run("readwrite", (s) => s.put(value, DB_RECORD)).then(() => undefined),
    clear: () => run("readwrite", (s) => s.delete(DB_RECORD)).then(() => undefined),
  };
}
