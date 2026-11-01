/** Once a step is ticked off, "Send to your team" text and Save PDF say which step is next. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import { planToText } from "@/lib/client/planText";
import { nextUpShareLine } from "@/lib/client/nextUp";
import type { Issue, WorkPlan, WorkStep } from "@/lib/types";

const DAY = new Date(2026, 10, 1, 12, 40);

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

const steps: WorkStep[] = [
  { order: 1, title: "Cables", detail: "", fixes: [1], hours: [2, 3], trade: "electrician" },
  { order: 2, title: "Handrails", detail: "", fixes: [2], hours: [4, 4], trade: "carpenter" },
  { order: 3, title: "Clean", detail: "", fixes: [3], hours: [2, 3], trade: "volunteers" },
  { order: 4, title: "Paint", detail: "", fixes: [3], dependsOn: 3, hours: [6, 8], trade: "painter" },
];

const issue = (rank: number): Issue => ({
  rank, title: `Problem ${rank}`, detail: "", severity: "high", frameIndex: 0, frameTimeSec: 0, unmentioned: false,
});

function plan(over: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Sanctuary stage",
    issues: [issue(1), issue(2), issue(3)],
    inventory: [],
    materials: [],
    costRange: null,
    workOrder: steps,
    ...over,
  } as unknown as WorkPlan;
}

test("nextUpShareLine: nothing on an untouched or finished plan", () => {
  assert.equal(nextUpShareLine(steps, []), null);
  assert.equal(nextUpShareLine(steps, [9]), null);
  assert.equal(nextUpShareLine(steps, [1, 2, 3, 4]), null);
  assert.equal(nextUpShareLine([], [1]), null);
});

test("nextUpShareLine names the next ready step, who and how long, and how many others can start", () => {
  assert.equal(nextUpShareLine(steps, [1]), "Next up: step 2, Handrails (Paid: carpenter, about 4 h). 1 other step can start now too.");
  assert.equal(nextUpShareLine(steps, [1, 2]), "Next up: step 3, Clean (Volunteer, about 2-3 h).");
  assert.equal(nextUpShareLine(steps, [1, 2, 3]), "Next up: step 4, Paint (Paid: painter, about 6-8 h).");
});

test("nextUpShareLine leaves out missing facts and trims the title", () => {
  const bare = [{ order: 1, title: "  Sweep   the aisle. " }, { order: 2, title: "Mop" }];
  assert.equal(nextUpShareLine(bare, [2]), "Next up: step 1, Sweep the aisle.");
});

test("nextUpShareLine says what the next step waits on when nothing open is ready", () => {
  const loop = [
    { order: 1, title: "Prep", dependsOn: undefined },
    { order: 2, title: "Prime", dependsOn: 3 },
    { order: 3, title: "Paint", dependsOn: 2, trade: "painter" },
  ];
  assert.equal(nextUpShareLine(loop, [1]), "Next up: step 2, Prime, once step 3 is done.");
});

test("Send to your team puts the Next up line after the progress line, real plans only", () => {
  const text = planToText(plan(), { date: DAY, doneSteps: [1] });
  const progress = text.indexOf("Progress: 1 of 4");
  const next = text.indexOf("Next up: step 2, Handrails");
  assert.ok(progress >= 0 && next > progress, text);
  assert.ok(!planToText(plan(), { date: DAY }).includes("Next up:"));
  assert.ok(!planToText(plan(), { date: DAY, sample: true, doneSteps: [1] }).includes("Next up:"));
  assert.ok(!planToText(plan(), { date: DAY, doneSteps: [1, 2, 3, 4] }).includes("Next up:"));
});

test("Save PDF prints the Next up line under the progress line", () => {
  const text = pdfText(buildPlanPdf(jsPDF, plan(), { date: DAY, compress: false, doneSteps: [1, 2] }));
  assert.ok(text.includes("Next up: step 3, Clean (Volunteer, about 2-3 h)."), text);
  assert.ok(text.indexOf("Progress: 2 of 4") < text.indexOf("Next up: step 3"));
  const untouched = pdfText(buildPlanPdf(jsPDF, plan(), { date: DAY, compress: false }));
  assert.ok(!untouched.includes("Next up:"));
});
