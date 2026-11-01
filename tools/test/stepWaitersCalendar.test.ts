import { test } from "node:test";
import assert from "node:assert/strict";
import { planCalendar, scheduleSteps, stepDescription } from "@/lib/client/stepCalendar";
import { crewHandoutText } from "@/lib/client/crewHandout";
import { crewSummary } from "@/lib/client/crewSummary";
import type { WorkPlan, WorkStep } from "@/lib/types";

const steps: WorkStep[] = [
  { order: 1, title: "Reroute the stage cable", detail: "", trade: "Electrician", hours: [1, 2], fixes: [1] },
  { order: 2, title: "Replace the exit sign", detail: "", trade: "Electrician", hours: [1, 1], fixes: [2], dependsOn: 1 },
  { order: 3, title: "Paint the back wall", detail: "", trade: "Volunteers", hours: [3, 4], fixes: [3], dependsOn: 1 },
];

function plan(workOrder: WorkStep[] = steps): WorkPlan {
  return {
    spaceName: "Main sanctuary stage",
    inventory: [],
    issues: [
      { rank: 1, title: "Cable across the steps", severity: "high", evidence: [] },
      { rank: 2, title: "Exit sign dark", severity: "high", evidence: [] },
      { rank: 3, title: "Scuffed wall", severity: "low", evidence: [] },
    ],
    materials: [],
    workOrder,
  } as unknown as WorkPlan;
}

const now = new Date(2026, 9, 30, 15, 0);
const unfold = (ics: string) => ics.replace(/\r\n /g, "");
const desc = (p: WorkPlan, order: number) => {
  const step = p.workOrder.find((s) => s.order === order)!;
  const block = scheduleSteps(p.workOrder, now).find((b) => b.order === order)!;
  return stepDescription(p, step, block);
};

test("calendar: a step two others wait on names both, after its own wait line", () => {
  const p = plan();
  assert.match(desc(p, 1), /When this is done, these can start: step 2 \(Replace the exit sign\); step 3 \(Paint the back wall\)\./);
  const two = desc(p, 2);
  assert.ok(!two.includes("When this is done"));
  assert.match(two, /Wait for step 1 \(Reroute the stage cable\) to finish first\./);
});

test("calendar: one waiter reads as one step, and the .ics carries it escaped", () => {
  const p = plan([steps[0], { ...steps[1] }, { ...steps[2], dependsOn: 2 }]);
  assert.match(desc(p, 2), /When this is done, step 3 \(Paint the back wall\) can start\./);
  const ics = unfold(planCalendar(p, now));
  assert.match(ics, /When this is done\\, step 3 \(Paint the back wall\) can start\./);
});

test("calendar: no waiters, no line", () => {
  const p = plan(steps.map((s) => ({ ...s, dependsOn: undefined })));
  for (const s of p.workOrder) assert.ok(!desc(p, s.order).includes("When this is done"));
});

test("crew handout: a waiter in another crew is named with its trade, one in the same crew is not", () => {
  const p = plan();
  const crew = crewSummary(p.workOrder).rows.find((r) => r.steps.includes(1))!;
  const text = crewHandoutText(p, crew, { date: now });
  assert.match(text, /   When this is done, these can start: step 2 \(Replace the exit sign\); step 3 \(Paint the back wall, Volunteers\)\./);
});
