/** Steps that others wait on, on paper: Save PDF prints "Step N waits on this." under the step. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf, type PlanPdfOptions } from "@/lib/client/planPdf";
import type { Issue, WorkPlan, WorkStep } from "@/lib/types";

const DAY = new Date(2026, 9, 30, 18, 0, 0);

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

const issue = (rank: number, title: string): Issue =>
  ({ rank, title, severity: "medium", detail: "", frameIndex: 0, confidence: 0.9 }) as unknown as Issue;

const mk = (workOrder: WorkStep[]): WorkPlan => ({
  spaceName: "Fellowship hall",
  generatedFrom: "Walkthrough video, 3 frames, 40 s",
  inventory: [],
  issues: [issue(1, "Loose cable"), issue(2, "Dead bulbs"), issue(3, "Scuffed wall")],
  materials: [],
  workOrder,
  afterImageUrl: null,
  transcript: null,
  frames: [],
});

const chained: WorkStep[] = [
  { order: 1, title: "Make safe", detail: "", fixes: [1] },
  { order: 2, title: "Lights", detail: "", fixes: [2], dependsOn: 1 },
  { order: 3, title: "Paint", detail: "", fixes: [3], dependsOn: 1 },
  { order: 4, title: "Clean up", detail: "", dependsOn: 3 },
];

const pdf = (plan: WorkPlan, opts: PlanPdfOptions = {}) => pdfText(buildPlanPdf(jsPDF, plan, { date: DAY, compress: false, ...opts }));

test("PDF: a step others wait on says which, one or several", () => {
  const text = pdf(mk(chained));
  assert.match(text, /Steps 2 and 3 wait on this\./);
  assert.match(text, /Step 4 waits on this\./);
  assert.equal(text.match(/wait(s)? on this\./g)?.length, 2);
});

test("PDF: no dependencies, no waits-on lines", () => {
  const text = pdf(mk(chained.map(({ dependsOn: _d, ...s }) => s as WorkStep)));
  assert.doesNotMatch(text, /wait(s)? on this/);
});

test("PDF: a step ticked done drops its waits-on line", () => {
  const text = pdf(mk(chained), { doneSteps: [1] });
  assert.doesNotMatch(text, /Steps 2 and 3 wait on this/);
  assert.match(text, /Step 4 waits on this\./);
});
