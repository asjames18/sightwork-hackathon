import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STEPS_CHANGED_EVENT,
  allStepsDone,
  planStepsKey,
  saveDoneSteps,
  shareProgressLine,
  subsetProgressLine,
} from "../../src/lib/client/stepProgress";
import { planToText } from "../../src/lib/client/planText";
import type { WorkPlan } from "../../src/lib/types";

const steps = [{ order: 1 }, { order: 2 }, { order: 3 }, { order: 4 }];

test("subsetProgressLine counts only the chosen steps", () => {
  assert.equal(subsetProgressLine([2, 3, 4], []), "");
  assert.equal(subsetProgressLine([2, 3, 4], [1]), "");
  assert.equal(subsetProgressLine([2, 3, 4], [1, 3]), "1 of 3 done.");
  assert.equal(subsetProgressLine([2, 3, 4], [4, 2, 3, 3]), "All 3 done.");
  assert.equal(subsetProgressLine([5], [5]), "Done.");
  assert.equal(subsetProgressLine([], [1]), "");
});

test("allStepsDone needs every fixing step ticked and at least one step", () => {
  assert.equal(allStepsDone([], [1, 2]), false);
  assert.equal(allStepsDone([2], [2]), true);
  assert.equal(allStepsDone([2, 3], [2]), false);
  assert.equal(allStepsDone([2, 3], [3, 2, 9]), true);
});

test("shareProgressLine names the ticked steps, ignores unknown ones", () => {
  assert.equal(shareProgressLine(steps, []), null);
  assert.equal(shareProgressLine(steps, [9]), null);
  assert.equal(shareProgressLine(steps, [3]), "Progress: 1 of 4 steps ticked off as done (step 3).");
  assert.equal(shareProgressLine(steps, [3, 1]), "Progress: 2 of 4 steps ticked off as done (steps 1 and 3).");
  assert.equal(shareProgressLine(steps, [4, 1, 2, 2]), "Progress: 3 of 4 steps ticked off as done (steps 1, 2 and 4).");
  assert.equal(shareProgressLine(steps, [1, 2, 3, 4]), "Progress: all 4 steps are ticked off as done.");
  assert.equal(shareProgressLine([{ order: 1 }], [1]), "Progress: the one step is ticked off as done.");
});

test("saveDoneSteps tells the page which plan changed", () => {
  const store = new Map<string, string>();
  const events: { type: string; key?: string }[] = [];
  const g = globalThis as Record<string, unknown>;
  const prevWindow = g.window;
  g.window = {
    localStorage: {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    dispatchEvent: (e: { type: string; detail?: { key?: string } }) => {
      events.push({ type: e.type, key: e.detail?.key });
      return true;
    },
  };
  try {
    const plan = { spaceName: "Hall", workOrder: [{ order: 1, title: "Sweep" }] } as unknown as WorkPlan;
    assert.equal(saveDoneSteps(plan, [1]), true);
    assert.equal(saveDoneSteps(plan, []), true);
    assert.deepEqual(events, [
      { type: STEPS_CHANGED_EVENT, key: planStepsKey(plan) },
      { type: STEPS_CHANGED_EVENT, key: planStepsKey(plan) },
    ]);
  } finally {
    g.window = prevWindow;
  }
});

function plan(over: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Fellowship hall",
    issues: [],
    inventory: [],
    materials: [],
    costRange: null,
    workOrder: [
      { order: 1, title: "Clear the aisle", fixes: [] },
      { order: 2, title: "Replace the bulb", fixes: [] },
    ],
    ...over,
  } as unknown as WorkPlan;
}

test("planToText adds the progress line after the steps on real plans only", () => {
  const date = new Date("2026-10-31T18:00:00Z");
  const real = planToText(plan(), { date, doneSteps: [2] });
  const line = "Progress: 1 of 2 steps ticked off as done (step 2).";
  assert.ok(real.includes(line), real);
  assert.ok(real.indexOf("2. Replace the bulb") < real.indexOf(line));
  assert.ok(!planToText(plan(), { date }).includes("Progress:"));
  assert.ok(!planToText(plan(), { date, sample: true, doneSteps: [2] }).includes("Progress:"));
});
