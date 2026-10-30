/** Recent plans on this device: index in localStorage, plans in a (fake) IndexedDB store. No network. */
import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  addRecentPlan,
  listRecentPlans,
  openRecentPlan,
  recentPlanId,
  recentWhen,
  removeRecentPlan,
  RECENT_INDEX_KEY,
  RECENT_MAX,
  setRecentPlanStoreForTests,
  type RecentPlanStore,
} from "@/lib/client/recentPlans";
import type { WorkPlan } from "@/lib/types";
import { fakeWindow, noWindow } from "./browser-stubs";

function fakeStore() {
  const data = new Map<string, unknown>();
  const s: RecentPlanStore & { data: Map<string, unknown>; fail?: boolean } = {
    data,
    get: async (id) => data.get(id),
    put: async (id, v) => {
      if (s.fail) throw new Error("quota");
      data.set(id, v);
    },
    remove: async (id) => void data.delete(id),
  };
  return s;
}

const plan = (name: string, issues = 2, region?: string) =>
  ({
    spaceName: name,
    generatedFrom: "Walkthrough video, 20 frames, 40 s",
    inventory: [],
    issues: Array.from({ length: issues }, (_, i) => ({ rank: i + 1, title: `${name} issue ${i + 1}` })),
    materials: [],
    workOrder: [],
    afterImageUrl: null,
    costRange: null,
    meta: region ? { region } : undefined,
  }) as unknown as WorkPlan;

let store: ReturnType<typeof fakeStore>;
beforeEach(() => {
  fakeWindow();
  store = fakeStore();
  setRecentPlanStoreForTests(store);
});
afterEach(() => {
  setRecentPlanStoreForTests(undefined);
  noWindow();
});

describe("recent plans", () => {
  test("adds newest first with space, City ST, time and problem count", async () => {
    assert.equal(await addRecentPlan(plan("Stage", 3, "Sebring, FL"), "a.mov", new Date("2026-10-30T22:00:00Z")), true);
    assert.equal(await addRecentPlan(plan("Office", 1), "b.mov", new Date("2026-10-30T22:10:00Z")), true);
    const list = listRecentPlans();
    assert.deepEqual(
      list.map((e) => [e.spaceName, e.region, e.problems, e.videoName]),
      [
        ["Office", null, 1, "b.mov"],
        ["Stage", "Sebring, FL", 3, "a.mov"],
      ],
    );
    assert.equal(store.data.size, 2);
  });

  test("same run saved again replaces its row instead of adding one", async () => {
    await addRecentPlan(plan("Stage"), "a.mov");
    await addRecentPlan(plan("Stage"), "a.mov");
    assert.equal(listRecentPlans().length, 1);
  });

  test(`keeps at most ${RECENT_MAX} and deletes the dropped plan's stored copy`, async () => {
    for (let i = 0; i < RECENT_MAX + 2; i++) await addRecentPlan(plan(`Room ${i}`), null);
    const list = listRecentPlans();
    assert.equal(list.length, RECENT_MAX);
    assert.equal(list[0].spaceName, `Room ${RECENT_MAX + 1}`);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(store.data.size, RECENT_MAX);
    assert.equal(store.data.has(recentPlanId(plan("Room 0"))), false);
  });

  test("opens a stored plan; a row whose copy is gone is dropped", async () => {
    const p = plan("Stage");
    await addRecentPlan(p, "a.mov");
    const id = listRecentPlans()[0].id;
    const saved = await openRecentPlan(id);
    assert.equal(saved?.plan.spaceName, "Stage");
    assert.equal(saved?.videoName, "a.mov");
    store.data.clear();
    assert.equal(await openRecentPlan(id), null);
    assert.equal(listRecentPlans().length, 0);
  });

  test("remove drops the row and the stored plan", async () => {
    await addRecentPlan(plan("A"), null);
    await addRecentPlan(plan("B"), null);
    const id = listRecentPlans()[0].id;
    await removeRecentPlan(id);
    assert.deepEqual(listRecentPlans().map((e) => e.spaceName), ["A"]);
    assert.equal(store.data.has(id), false);
  });

  test("nothing is listed when the plan can't be stored, or there is no IndexedDB", async () => {
    store.fail = true;
    assert.equal(await addRecentPlan(plan("A"), null), false);
    setRecentPlanStoreForTests(null);
    assert.equal(await addRecentPlan(plan("B"), null), false);
    assert.equal(listRecentPlans().length, 0);
  });

  test("a broken or foreign index reads as empty, and the list is stable while unchanged", () => {
    const { store: ls } = fakeWindow();
    ls.set(RECENT_INDEX_KEY, "{not json");
    assert.deepEqual(listRecentPlans(), []);
    ls.set(RECENT_INDEX_KEY, JSON.stringify([{ id: 1 }, { id: "x", spaceName: "S", savedAt: "2026-10-30T22:00:00Z", region: null, problems: 0, videoName: null }]));
    const a = listRecentPlans();
    assert.equal(a.length, 1);
    assert.equal(listRecentPlans(), a);
  });

  test("blank space name shows as Walkthrough; time reads short", async () => {
    await addRecentPlan(plan("  "), null);
    assert.equal(listRecentPlans()[0].spaceName, "Walkthrough");
    assert.match(recentWhen("2026-10-30T22:12:00Z", "en-US"), /^Oct 30, \d{1,2}:12 [AP]M$/);
    assert.equal(recentWhen("nope"), "");
  });
});
