/** Last plan on this device: small plans in localStorage, big real runs in IndexedDB behind a marker. */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  BIG_MARKER_KEY,
  hasLastPlan,
  loadLastPlan,
  loadLastPlanAsync,
  saveLastPlan,
  setBigPlanStoreForTests,
  type BigPlanStore,
  type SavedPlan,
} from "@/lib/client/lastPlan";
import { FEATURED_EXAMPLE } from "@/lib/examples";
import type { WorkPlan } from "@/lib/types";
import { fakeWindow, noWindow } from "./browser-stubs";

const KEY = "sightwork:lastPlan:v1";

afterEach(() => {
  noWindow();
  setBigPlanStoreForTests(undefined);
});

/** localStorage that refuses values longer than `limit` chars, like a full phone browser. */
function cappedWindow(limit: number) {
  const { store } = fakeWindow();
  const w = (globalThis as unknown as { window: { localStorage: Storage } }).window;
  const set = w.localStorage.setItem.bind(w.localStorage);
  w.localStorage.setItem = (k: string, v: string) => {
    if (String(v).length > limit) throw new DOMException("quota", "QuotaExceededError");
    set(k, v);
  };
  return store;
}

function memoryStore(opts: { failPut?: boolean } = {}) {
  let value: unknown = null;
  const calls: string[] = [];
  const store: BigPlanStore = {
    get: async () => (calls.push("get"), value),
    put: async (v: SavedPlan) => {
      calls.push("put");
      if (opts.failPut) throw new Error("quota");
      value = structuredClone(v);
    },
    clear: async () => {
      calls.push("clear");
      value = null;
    },
  };
  return { store, calls, peek: () => value, set: (v: unknown) => (value = v) };
}

const plan: WorkPlan = FEATURED_EXAMPLE.plan;
const bigPlan: WorkPlan = { ...plan, afterImageUrl: "data:image/jpeg;base64," + "A".repeat(20_000) };

test("a plan that fits stays in localStorage and reads back without waiting", async () => {
  const store = cappedWindow(1_000_000);
  const mem = memoryStore();
  setBigPlanStoreForTests(mem.store);
  assert.equal(hasLastPlan(), false);
  assert.equal(saveLastPlan(plan, "walk.mov"), true);
  assert.ok(store.has(KEY));
  assert.equal(store.has(BIG_MARKER_KEY), false);
  assert.equal(hasLastPlan(), true);
  assert.equal(loadLastPlan()?.videoName, "walk.mov");
  assert.equal((await loadLastPlanAsync())?.plan.spaceName, plan.spaceName);
  assert.deepEqual(mem.calls, ["clear"], "an older big copy is dropped, nothing else touched");
});

test("a plan too big for localStorage goes to IndexedDB behind a small marker", async () => {
  const store = cappedWindow(10_000);
  const mem = memoryStore();
  setBigPlanStoreForTests(mem.store);
  store.set(KEY, JSON.stringify({ plan, videoName: "old.mov", savedAt: "x" }));
  const result = saveLastPlan(bigPlan, "long-walk.mov");
  assert.ok(result instanceof Promise);
  assert.equal(store.has(KEY), false, "the stale small copy is dropped");
  assert.ok(store.has(BIG_MARKER_KEY), "the marker is written before IndexedDB finishes");
  assert.ok(!store.get(BIG_MARKER_KEY)!.includes("base64"), "the marker never holds the plan");
  assert.equal(hasLastPlan(), true);
  assert.equal(await result, true);
  assert.equal(loadLastPlan(), null, "the sync read only sees localStorage");
  const saved = await loadLastPlanAsync();
  assert.equal(saved?.videoName, "long-walk.mov");
  assert.equal(saved?.plan.afterImageUrl, bigPlan.afterImageUrl);
});

test("a small plan saved after a big one replaces it", async () => {
  const store = cappedWindow(10_000);
  const mem = memoryStore();
  setBigPlanStoreForTests(mem.store);
  await saveLastPlan(bigPlan, "long-walk.mov");
  const small: WorkPlan = { ...plan, frames: [], afterImageUrl: null, issues: plan.issues.slice(0, 1), inventory: [], materials: [], workOrder: [] };
  assert.equal(saveLastPlan(small, "short.mov"), true);
  assert.equal(store.has(BIG_MARKER_KEY), false);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(mem.peek(), null, "the big copy is cleared");
  assert.equal((await loadLastPlanAsync())?.videoName, "short.mov");
});

test("IndexedDB refusing the plan clears the marker and reports false", async () => {
  const store = cappedWindow(10_000);
  setBigPlanStoreForTests(memoryStore({ failPut: true }).store);
  assert.equal(await saveLastPlan(bigPlan, "long-walk.mov"), false);
  assert.equal(store.has(BIG_MARKER_KEY), false);
  assert.equal(hasLastPlan(), false);
});

test("no IndexedDB: a big plan is simply not kept", async () => {
  const store = cappedWindow(10_000);
  setBigPlanStoreForTests(null);
  assert.equal(saveLastPlan(bigPlan, "long-walk.mov"), false);
  assert.equal(store.size, 0);
  assert.equal(await loadLastPlanAsync(), null);
});

test("a marker whose IndexedDB copy is gone or broken is cleared", async () => {
  const store = cappedWindow(10_000);
  const mem = memoryStore();
  setBigPlanStoreForTests(mem.store);
  store.set(BIG_MARKER_KEY, '{"videoName":null}');
  assert.equal(hasLastPlan(), true);
  mem.set({ plan: {} });
  assert.equal(await loadLastPlanAsync(), null);
  assert.equal(store.has(BIG_MARKER_KEY), false);
  assert.equal(hasLastPlan(), false);
});

test("a throwing IndexedDB read fails quietly", async () => {
  const store = cappedWindow(10_000);
  setBigPlanStoreForTests({
    get: async () => {
      throw new Error("blocked");
    },
    put: async () => {},
    clear: async () => {},
  });
  store.set(BIG_MARKER_KEY, "{}");
  assert.equal(await loadLastPlanAsync(), null);
});

test("no window at all: every call fails quietly", async () => {
  noWindow();
  setBigPlanStoreForTests(null);
  assert.equal(hasLastPlan(), false);
  assert.equal(loadLastPlan(), null);
  assert.equal(saveLastPlan(plan, null), false);
  assert.equal(await loadLastPlanAsync(), null);
});
