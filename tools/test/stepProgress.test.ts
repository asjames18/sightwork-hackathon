/** Work-step checklist progress kept per plan on this device. No network. */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadDoneSteps, planStepsKey, progressLine, saveDoneSteps } from "@/lib/client/stepProgress";
import { fakeWindow, noWindow } from "./browser-stubs";

const plan = {
  spaceName: "Main stage",
  workOrder: [
    { order: 1, title: "Cover the cable", detail: "" },
    { order: 2, title: "Re-tape the seam", detail: "" },
    { order: 3, title: "Add a handrail", detail: "" },
  ],
};

/** fakeWindow's storage plus length/key, so pruning can walk it. */
function windowWithKeys() {
  const { store } = fakeWindow();
  const ls = (globalThis as unknown as { window: { localStorage: Record<string, unknown> } }).window.localStorage;
  Object.defineProperty(ls, "length", { get: () => store.size });
  ls.key = (i: number) => [...store.keys()][i] ?? null;
  return store;
}

afterEach(() => noWindow());

test("the key is stable for the same plan and changes when the steps change", () => {
  assert.equal(planStepsKey(plan), planStepsKey({ ...plan }));
  assert.match(planStepsKey(plan), /^sightwork:steps:v1:[0-9a-z]+$/);
  const other = { ...plan, workOrder: [...plan.workOrder.slice(0, 2), { order: 3, title: "Paint the rail", detail: "" }] };
  assert.notEqual(planStepsKey(plan), planStepsKey(other));
  assert.notEqual(planStepsKey(plan), planStepsKey({ ...plan, spaceName: "Classroom" }));
});

test("saved ticks load back sorted and deduplicated", () => {
  windowWithKeys();
  assert.deepEqual(loadDoneSteps(plan), []);
  assert.equal(saveDoneSteps(plan, [3, 1, 3]), true);
  assert.deepEqual(loadDoneSteps(plan), [1, 3]);
});

test("ticks for steps that no longer exist are ignored", () => {
  const store = windowWithKeys();
  store.set(planStepsKey(plan), JSON.stringify({ done: [2, 9, "x"], at: 1 }));
  assert.deepEqual(loadDoneSteps(plan), [2]);
});

test("clearing removes the entry", () => {
  const store = windowWithKeys();
  saveDoneSteps(plan, [1]);
  assert.equal(store.size, 1);
  saveDoneSteps(plan, []);
  assert.equal(store.size, 0);
});

test("only the newest 20 plans are kept", () => {
  const store = windowWithKeys();
  for (let i = 0; i < 25; i++) {
    store.set(`sightwork:steps:v1:old${i}`, JSON.stringify({ done: [1], at: i }));
  }
  store.set("sightwork:lastPlan:v1", "{}");
  saveDoneSteps(plan, [1]);
  const kept = [...store.keys()].filter((k) => k.startsWith("sightwork:steps:v1:"));
  assert.equal(kept.length, 20);
  assert.ok(kept.includes(planStepsKey(plan)));
  assert.ok(!kept.includes("sightwork:steps:v1:old0"));
  assert.ok(store.has("sightwork:lastPlan:v1"), "other keys are left alone");
});

test("bad JSON, no window and refused storage fail quietly", () => {
  const store = windowWithKeys();
  store.set(planStepsKey(plan), "{not json");
  assert.deepEqual(loadDoneSteps(plan), []);
  const ls = (globalThis as unknown as { window: { localStorage: { setItem: unknown } } }).window.localStorage;
  ls.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.equal(saveDoneSteps(plan, [1]), false);
  noWindow();
  assert.deepEqual(loadDoneSteps(plan), []);
  assert.equal(saveDoneSteps(plan, [1]), false);
});

test("progress line wording", () => {
  assert.equal(progressLine(0, 4), "");
  assert.equal(progressLine(2, 4), "2 of 4 steps done.");
  assert.equal(progressLine(4, 4), "All 4 steps done.");
  assert.equal(progressLine(1, 1), "The step is done.");
  assert.equal(progressLine(0, 0), "");
});
