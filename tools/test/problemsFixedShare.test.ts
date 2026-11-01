/** Problems fixed line in the Send to your team text (problemsFixed.ts, planText.ts). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { shareFixedLine } from "@/lib/client/problemsFixed";
import { planToText } from "@/lib/client/planText";
import type { WorkPlan, WorkStep } from "@/lib/types";

const step = (order: number, fixes?: number[]): WorkStep => ({ order, title: `Step ${order}`, detail: "", fixes });
const issues = [{ rank: 1 }, { rank: 2 }, { rank: 3 }, { rank: 4 }];
const work = [step(1, [1]), step(2, [2, 3]), step(3, [3]), step(4)];

test("no line until a problem is actually fixed", () => {
  assert.equal(shareFixedLine(issues, work, []), null);
  assert.equal(shareFixedLine(issues, work, [3]), null); // #3 still needs step 2
  assert.equal(shareFixedLine(issues, work, [4]), null); // step 4 fixes nothing
  assert.equal(shareFixedLine(issues, [step(1), step(2)], [1]), null);
});

test("names the fixed problems in rank order", () => {
  assert.equal(shareFixedLine(issues, work, [2]), "Problems fixed: 1 of 3 (#2).");
  assert.equal(shareFixedLine(issues, work, [2, 1]), "Problems fixed: 2 of 3 (#1 and #2).");
  assert.equal(shareFixedLine([...issues, { rank: 5 }], [...work, step(5, [5])], [5, 2, 1]), "Problems fixed: 3 of 4 (#1, #2 and #5).");
});

test("all fixed reads as finished", () => {
  assert.equal(shareFixedLine(issues, work, [1, 2, 3]), "Problems fixed: all 3.");
  assert.equal(shareFixedLine([{ rank: 1 }], [step(1, [1])], [1]), "Problems fixed: the one tracked problem.");
});

function plan(): WorkPlan {
  return {
    spaceName: "Fellowship hall",
    issues: [
      { rank: 1, title: "Loose aisle carpet", severity: "high", area: "Aisle", evidence: [] },
      { rank: 2, title: "Dead bulb", severity: "low", area: "Stage", evidence: [] },
    ],
    inventory: [],
    materials: [],
    costRange: null,
    workOrder: [
      { order: 1, title: "Clear the aisle", detail: "", fixes: [1] },
      { order: 2, title: "Replace the bulb", detail: "", fixes: [2] },
    ],
  } as unknown as WorkPlan;
}

test("planToText puts the fixed line right under the step progress line, real plans only", () => {
  const date = new Date("2026-11-01T11:00:00Z");
  const text = planToText(plan(), { date, doneSteps: [2] });
  const progress = "Progress: 1 of 2 steps ticked off as done (step 2).";
  const fixed = "Problems fixed: 1 of 2 (#2).";
  assert.ok(text.includes(`${progress}\n${fixed}`), text);
  assert.ok(!planToText(plan(), { date }).includes("Problems fixed"));
  assert.ok(!planToText(plan(), { date, sample: true, doneSteps: [2] }).includes("Problems fixed"));
});
