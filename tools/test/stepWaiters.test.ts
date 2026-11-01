/** Steps that wait on a step (stepWaiters.ts) and the line Send this step adds for them. */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { WorkPlan, WorkStep } from "@/lib/types";
import { stepsWaitingOn, waitersChipLabel, waitersDescription, waitersShareLine } from "@/lib/client/stepWaiters";
import { stepToText } from "@/lib/client/stepText";

const steps: WorkStep[] = [
  { order: 1, title: "Clear the stage", detail: "" },
  { order: 2, title: "Tape down cables.", detail: "", dependsOn: 1 },
  { order: 3, title: "Paint the rail", detail: "", dependsOn: 1 },
  { order: 4, title: "Rehang the banner", detail: "", dependsOn: 3 },
  { order: 5, title: "Odd", detail: "", dependsOn: 5 },
];

test("finds the steps that wait on a step, lowest first, never itself", () => {
  assert.deepEqual(stepsWaitingOn([...steps].reverse(), 1).map((s) => s.order), [2, 3]);
  assert.deepEqual(stepsWaitingOn(steps, 3).map((s) => s.order), [4]);
  assert.deepEqual(stepsWaitingOn(steps, 2), []);
  assert.deepEqual(stepsWaitingOn(steps, 5), []);
});

test("chip and screen reader wording", () => {
  assert.equal(waitersChipLabel([]), "");
  assert.equal(waitersChipLabel([4]), "Step 4 waits on this");
  assert.equal(waitersChipLabel([2, 3]), "Steps 2 and 3 wait on this");
  assert.equal(waitersChipLabel([2, 3, 6]), "Steps 2, 3 and 6 wait on this");
  assert.equal(waitersDescription([4]), "Step 4 can't start until this step is done.");
  assert.equal(waitersDescription([2, 3]), "Steps 2 and 3 can't start until this step is done.");
});

test("share line names the waiting steps", () => {
  assert.equal(waitersShareLine([]), null);
  assert.equal(waitersShareLine(stepsWaitingOn(steps, 3)), "When this is done, step 4 (Rehang the banner) can start.");
  assert.equal(
    waitersShareLine(stepsWaitingOn(steps, 1)),
    "When this is done, these can start: step 2 (Tape down cables); step 3 (Paint the rail).",
  );
});

test("Send this step carries the line right after the wait-for line", () => {
  const plan = { spaceName: "", issues: [], materials: [], workOrder: steps } as unknown as Pick<
    WorkPlan,
    "spaceName" | "issues" | "materials" | "workOrder"
  >;
  const lines = stepToText(plan, steps[2]).split("\n");
  const wait = lines.indexOf("Wait for step 1 (Clear the stage) to finish first.");
  assert.ok(wait > 0);
  assert.equal(lines[wait + 1], "When this is done, step 4 (Rehang the banner) can start.");
  assert.ok(!stepToText(plan, steps[1]).includes("When this is done"));
});
