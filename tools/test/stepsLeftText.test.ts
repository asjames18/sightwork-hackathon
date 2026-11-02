import { test } from "node:test";
import assert from "node:assert/strict";
import { canSendStepsLeft, sendStepsLeftLabel, stepsLeft, stepsLeftText, stepsLeftTitle } from "../../src/lib/client/stepsLeftText";

const plan = {
  spaceName: "Sanctuary stage",
  issues: [
    { rank: 1, title: "Loose cable across the stage edge" },
    { rank: 2, title: "Scuffed  stage\nfront" },
  ],
  workOrder: [
    { order: 1, title: "Clear the stage", trade: "Volunteer", hours: [1, 1], fixes: [] },
    { order: 2, title: "Tape down cables", trade: "volunteers", hours: [1, 2], fixes: [1] },
    { order: 3, title: "Paint the stage front", trade: "Painter", hours: [2, 4], fixes: [2, 9] },
  ],
} as never;

test("button shows only when something is ticked and something is left", () => {
  assert.equal(canSendStepsLeft(plan, []), false);
  assert.equal(canSendStepsLeft(plan, [1, 2, 3]), false);
  assert.equal(canSendStepsLeft(plan, [7]), false);
  assert.equal(canSendStepsLeft(plan, [1]), true);
  assert.deepEqual(stepsLeft(plan, [1]).map((s) => s.order), [2, 3]);
});

test("labels and titles read naturally", () => {
  assert.equal(sendStepsLeftLabel(1), "Send the last step");
  assert.equal(sendStepsLeftLabel(3), "Send the 3 steps left");
  assert.equal(stepsLeftTitle(plan, 2), "Sanctuary stage: 2 steps left");
  assert.equal(stepsLeftTitle({ spaceName: " " } as never, 1), "Work plan: 1 step left");
});

test("text lists only the steps left, in order, with who, hours and fixes", () => {
  const text = stepsLeftText(plan, [1]);
  const lines = text.split("\n");
  assert.equal(lines[0], "Sanctuary stage: 2 of 3 steps left");
  assert.match(lines[1], /of work left on the 2 steps not ticked yet\.$/);
  assert.ok(!text.includes("Clear the stage"));
  assert.ok(text.includes("Step 2: Tape down cables (Volunteer, about 1-2 h)\n  Fixes #1 Loose cable across the stage edge"));
  assert.ok(text.includes("Step 3: Paint the stage front (Paid: Painter, about 2-4 h)\n  Fixes #2 Scuffed stage front"));
  assert.ok(!text.includes("#9"));
  assert.ok(text.indexOf("Step 2") < text.indexOf("Step 3"));
  assert.ok(text.includes("Done: step 1."));
  assert.ok(text.trimEnd().endsWith("sightwork.vercel.app"));
});

test("example plans say so and several done steps are listed in order", () => {
  const text = stepsLeftText(plan, [2, 1], { sample: true });
  assert.ok(text.startsWith("Example plan, not a real inspection.\nSanctuary stage: 1 of 3 steps left"));
  assert.ok(text.includes("on the last step."));
  assert.ok(text.includes("Done: steps 1, 2."));
});
