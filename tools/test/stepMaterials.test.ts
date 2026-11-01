/** Which materials a work step needs and whether they are in hand (stepMaterials.ts), plus the Bring list marks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Issue, MaterialItem, WorkPlan, WorkStep } from "@/lib/types";
import {
  stepMaterialIndexes,
  stepMaterialsDescription,
  stepMaterialsLabel,
  stepMaterialsState,
} from "@/lib/client/stepMaterials";
import { stepToText } from "@/lib/client/stepText";

const issues = [
  { rank: 2, title: "Loose cable" },
  { rank: 5, title: "Dead bulb" },
] as Issue[];
const materials: MaterialItem[] = [
  { item: "Gaffer tape", qty: "2 rolls", forIssues: [2] },
  { item: "LED  bulb", qty: "1", forIssues: [5] },
  { item: "Cable ramp", qty: "1", forIssues: [2, 5] },
  { item: "Ghost item", qty: "1", forIssues: [9] },
];
const steps: WorkStep[] = [
  { order: 1, title: "Clear the stage", detail: "" },
  { order: 2, title: "Tape cables", detail: "", fixes: [2] },
  { order: 3, title: "Swap bulb", detail: "", fixes: [5] },
  { order: 4, title: "Ghost fix", detail: "", fixes: [9] },
];
const plan = { spaceName: "Sanctuary", issues, materials, workOrder: steps } as Pick<WorkPlan, "spaceName" | "issues" | "materials" | "workOrder">;

test("indexes follow the problems the step fixes, in list order", () => {
  assert.deepEqual(stepMaterialIndexes(plan, steps[1]), [0, 2]);
  assert.deepEqual(stepMaterialIndexes(plan, steps[2]), [1, 2]);
  assert.deepEqual(stepMaterialIndexes(plan, steps[0]), []);
});

test("a fix for a problem not on the plan needs nothing", () => {
  assert.deepEqual(stepMaterialIndexes(plan, steps[3]), []);
  assert.equal(stepMaterialsState(plan, steps[3]), null);
});

test("state counts what is in hand and names what is still to buy", () => {
  assert.deepEqual(stepMaterialsState(plan, steps[2]), { total: 2, have: 0, missing: ["LED bulb", "Cable ramp"] });
  assert.deepEqual(stepMaterialsState(plan, steps[2], [2, 0]), { total: 2, have: 1, missing: ["LED bulb"] });
  assert.deepEqual(stepMaterialsState(plan, steps[2], [1, 2]), { total: 2, have: 2, missing: [] });
});

test("labels", () => {
  assert.equal(stepMaterialsLabel({ total: 3, have: 0, missing: [] }), "Needs 3 items");
  assert.equal(stepMaterialsLabel({ total: 1, have: 0, missing: [] }), "Needs 1 item");
  assert.equal(stepMaterialsLabel({ total: 3, have: 1, missing: [] }), "1 of 3 items in hand");
  assert.equal(stepMaterialsLabel({ total: 3, have: 3, missing: [] }), "Materials in hand");
  assert.equal(stepMaterialsLabel({ total: 1, have: 1, missing: [] }), "Item in hand");
  assert.equal(stepMaterialsDescription({ total: 2, have: 1, missing: ["LED bulb"] }), "Still to buy for this step: LED bulb.");
  assert.equal(stepMaterialsDescription({ total: 2, have: 2, missing: [] }), "Everything this step needs is in hand.");
});

test("Send this step marks Bring items already in hand", () => {
  const lines = stepToText(plan, steps[1], { got: [2] }).split("\n");
  const at = lines.indexOf("Bring:");
  assert.ok(at > 0);
  assert.deepEqual(lines.slice(at + 1, at + 3), ["- Gaffer tape: 2 rolls", "- Cable ramp: 1 (in hand)"]);
  // Without ticks the list reads as before.
  assert.ok(!stepToText(plan, steps[1]).includes("(in hand)"));
});
