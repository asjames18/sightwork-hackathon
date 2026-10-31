/** One crew's part of the plan as plain text (the Send button on each "Who does the work" row). No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { crewHandoutText, crewHandoutTitle } from "@/lib/client/crewHandout";
import { crewSummary } from "@/lib/client/crewSummary";
import { SHARE_SIGNOFF } from "@/lib/client/planText";
import type { WorkPlan } from "@/lib/types";

const date = new Date(2026, 9, 31);

function plan(extra: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Main  sanctuary stage",
    generatedFrom: "Walkthrough video",
    inventory: [],
    issues: [
      { rank: 1, title: "Cable across the steps", detail: "", severity: "high", frameIndex: 0, frameTimeSec: 2, unmentioned: true },
      { rank: 2, title: "Exit sign dark", detail: "", severity: "high", frameIndex: 1, frameTimeSec: 4, unmentioned: true },
      { rank: 3, title: "Scuffed back wall", detail: "", severity: "low", frameIndex: 2, frameTimeSec: 9, unmentioned: false },
    ],
    materials: [
      { item: "Cable cover", qty: "2", forIssues: [1] },
      { item: "LED exit sign", qty: "1", forIssues: [2] },
      { item: "Eggshell paint", qty: "1 gal", forIssues: [3] },
    ],
    workOrder: [
      { order: 1, title: "Reroute the stage cable", detail: "Run it under the riser.", trade: "Electrician", hours: [1, 2], fixes: [1] },
      { order: 2, title: "Replace the exit sign", detail: "", trade: "electrician", hours: [1, 1], fixes: [2], dependsOn: 1 },
      { order: 3, title: "Paint the back wall", detail: "Two coats.", trade: "Volunteers", hours: [3, 4], fixes: [3], dependsOn: 2 },
    ],
    afterImageUrl: null,
    transcript: null,
    meta: { region: "Atlanta, GA" } as WorkPlan["meta"],
    ...extra,
  };
}

test("electrician handout: their steps only, fixes, waits, and only their materials", () => {
  const p = plan();
  const crew = crewSummary(p.workOrder).rows[0];
  const text = crewHandoutText(p, crew, { date });
  assert.equal(crewHandoutTitle(p, crew), "Electrician: Main sanctuary stage");
  assert.match(text, /^Electrician: your part of the work plan for Main sanctuary stage\nAtlanta, GA · Oct 31, 2026\n2 steps, about 2–3 h of work\./);
  assert.match(text, /Step 1\. Reroute the stage cable \(1-2 h\)\n   Run it under the riser\.\n   Fixes: #1 Cable across the steps/);
  assert.match(text, /Step 2\. Replace the exit sign \(1 h\)\n   Fixes: #2 Exit sign dark\n   Wait for step 1 \(Reroute the stage cable\) to finish first\./);
  assert.ok(!text.includes("Paint the back wall"));
  assert.match(text, /Materials for these steps:\n- Cable cover: 2\n- LED exit sign: 1/);
  assert.ok(!text.includes("Eggshell"));
  assert.match(text, /The full plan has 3 steps; this list is steps 1 and 2 only\./);
  assert.ok(text.endsWith(SHARE_SIGNOFF));
  assert.ok(!text.includes("Example plan"));
});

test("volunteer handout names the other crew they wait on and says it is volunteer work", () => {
  const p = plan();
  const crew = crewSummary(p.workOrder).rows[1];
  const text = crewHandoutText(p, crew, { date });
  assert.match(text, /^Volunteers: your part/);
  assert.match(text, /1 step, about 3–4 h of work, volunteer work\./);
  assert.match(text, /Wait for step 2 \(Replace the exit sign, electrician\) to finish first\./);
  assert.match(text, /- Eggshell paint: 1 gal/);
  assert.match(text, /this list is step 3 only\./);
});

test("example plans are labeled; a crew with every step gets no 'full plan' line; no hours means no hours", () => {
  const p = plan({
    workOrder: [{ order: 1, title: "Sweep", detail: "", trade: "Volunteer" }],
    meta: { isExample: true } as WorkPlan["meta"],
  });
  const crew = crewSummary(p.workOrder).rows[0];
  const text = crewHandoutText(p, crew, { date });
  assert.match(text, /\n1 step, volunteer work\.\nExample plan with sample data, not a real run\./);
  assert.match(text, /Step 1\. Sweep\n/);
  assert.ok(!text.includes("full plan"));
  assert.ok(!text.includes("Materials for these steps"));
});

test("long handouts are cut at a line and keep the sign-off", () => {
  const long = "Detail that goes on and on. ".repeat(20);
  const workOrder = Array.from({ length: 12 }, (_, i) => ({ order: i + 1, title: `Step title ${i + 1}`, detail: long, trade: "Painter", hours: [1, 2] as [number, number] }));
  const p = plan({ workOrder });
  const text = crewHandoutText(p, crewSummary(workOrder).rows[0], { date, maxChars: 900 });
  assert.ok(text.length <= 900, `length ${text.length}`);
  assert.ok(text.endsWith(`...\nShortened for a text.\n\n${SHARE_SIGNOFF}`));
});
