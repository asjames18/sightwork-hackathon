/** One work step as share text (stepText.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Issue, MaterialItem, WorkPlan, WorkStep } from "@/lib/types";
import { stepShareTitle, stepToText, stepWhoLabel } from "@/lib/client/stepText";
import { SHARE_SIGNOFF } from "@/lib/client/planText";

const issues = [
  { rank: 2, title: "Loose cable  across the stage edge" },
  { rank: 5, title: "Dead bulb over the pulpit" },
] as Issue[];
const materials: MaterialItem[] = [
  { item: "Gaffer tape", qty: "2 rolls", forIssues: [2] },
  { item: "LED bulb", qty: "1", forIssues: [5] },
  { item: "Cable ramp", qty: "1", forIssues: [2, 5] },
];
const steps: WorkStep[] = [
  { order: 1, title: "Clear the stage", detail: "Move the chairs off.", trade: "Volunteers", hours: [1, 1] },
  { order: 2, title: "Tape down stage cables", detail: "Run tape along the  front edge.", dependsOn: 1, fixes: [2, 2, 9], trade: "Volunteer", hours: [1, 2] },
  { order: 3, title: "Swap the pulpit bulb", detail: "", fixes: [5], trade: "Electrician" },
];
const plan = { spaceName: "Sanctuary", issues, materials, workOrder: steps } as Pick<WorkPlan, "spaceName" | "issues" | "materials" | "workOrder">;

test("full text, in order", () => {
  assert.deepEqual(stepToText(plan, steps[1]).split("\n"), [
    "Step 2 of 3 · Volunteer",
    "Tape down stage cables",
    "About 1-2 h",
    "Run tape along the front edge.",
    "Fixes: #2 Loose cable across the stage edge",
    "Wait for step 1 (Clear the stage) to finish first.",
    "Bring:",
    "- Gaffer tape: 2 rolls",
    "- Cable ramp: 1",
    "Space: Sanctuary",
    "",
    SHARE_SIGNOFF,
  ]);
});

test("paid trade, no hours, no detail, no wait", () => {
  const text = stepToText(plan, steps[2]);
  assert.ok(text.startsWith("Step 3 of 3 · Paid: Electrician\nSwap the pulpit bulb\nFixes: #5 Dead bulb over the pulpit\n"));
  assert.ok(!text.includes("About"));
  assert.ok(!text.includes("Wait for"));
  assert.ok(text.includes("- LED bulb: 1\n- Cable ramp: 1"));
});

test("sample plans say so first; a step that fixes nothing brings nothing", () => {
  const text = stepToText(plan, steps[0], { sample: true });
  assert.ok(text.startsWith("Example plan, not a real inspection.\nStep 1 of 3 · Volunteer\n"));
  assert.ok(text.includes("About 1 h"));
  assert.ok(!text.includes("Fixes:"));
  assert.ok(!text.includes("Bring:"));
});

test("When: line matches the calendar schedule when asked", () => {
  // Fri Oct 30 2026 at noon: the plan starts the next workday, Mon Nov 2, 9 AM.
  const text = stepToText(plan, steps[0], { scheduleFrom: new Date(2026, 9, 30, 12) });
  assert.match(text, /\nWhen: Mon, Nov 2, 9 AM to 10 AM\n/);
  assert.ok(!stepToText(plan, steps[0]).includes("When:"));
});

test("no trade, no space: those lines drop out", () => {
  const bare = { ...plan, spaceName: "" };
  const text = stepToText(bare, { order: 1, title: "Look", detail: "Look" });
  // Step 2 of this plan waits on step 1, so the text says who can start next.
  assert.deepEqual(text.split("\n"), ["Step 1 of 3", "Look", "When this is done, step 2 (Tape down stage cables) can start.", "", SHARE_SIGNOFF]);
});

test("labels and title", () => {
  assert.equal(stepWhoLabel(undefined), null);
  assert.equal(stepWhoLabel("  "), null);
  assert.equal(stepWhoLabel("volunteer crew"), "Volunteer");
  assert.equal(stepWhoLabel("Painter"), "Paid: Painter");
  assert.equal(stepShareTitle({ order: 4, title: " Patch  the wall " }), "Step 4: Patch the wall");
});
