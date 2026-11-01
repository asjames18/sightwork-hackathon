/** Save PDF progress: ticked-off steps are marked Done and the progress and problems fixed lines print (real plans only). No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf, type PlanPdfOptions } from "@/lib/client/planPdf";
import { pdfKeyOf } from "@/lib/client/savePlanPdf";
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

const steps: WorkStep[] = [
  { order: 1, title: "Make safe", detail: "", fixes: [1] },
  { order: 2, title: "Lights", detail: "", fixes: [2] },
  { order: 3, title: "Paint", detail: "", fixes: [3] },
];

const plan: WorkPlan = {
  spaceName: "Fellowship hall",
  generatedFrom: "Walkthrough video, 3 frames, 40 s",
  inventory: [],
  issues: [issue(1, "Loose cable"), issue(2, "Dead bulbs"), issue(3, "Scuffed wall")],
  materials: [],
  workOrder: steps,
  afterImageUrl: null,
  transcript: null,
  frames: [],
};

const pdf = (opts: PlanPdfOptions = {}) => pdfText(buildPlanPdf(jsPDF, plan, { date: DAY, compress: false, ...opts }));

test("no ticks: no progress lines and no Done marks", () => {
  const text = pdf();
  assert.doesNotMatch(text, /Progress:/);
  assert.doesNotMatch(text, /Problems fixed:/);
  assert.doesNotMatch(text, /DONE/);
});

test("some ticks: progress and problems fixed lines, Done on each ticked step only", () => {
  const text = pdf({ doneSteps: [1, 3] });
  assert.match(text, /Progress: 2 of 3 steps ticked off as done/);
  assert.match(text, /Problems fixed: 2 of 3 \(#1 and #3\)\./);
  assert.equal(text.match(/DONE/g)?.length, 2);
});

test("every step ticked: all-done lines", () => {
  const text = pdf({ doneSteps: [3, 2, 1, 2] });
  assert.match(text, /Progress: all 3 steps are ticked off as done\./);
  assert.match(text, /Problems fixed: all 3\./);
  assert.equal(text.match(/DONE/g)?.length, 3);
});

test("sample and example PDFs ignore ticks", () => {
  for (const opts of [{ sample: true }, { example: { kind: "real" as const, banner: "Real run kept as an example" } }]) {
    const text = pdf({ ...opts, doneSteps: [1] });
    assert.doesNotMatch(text, /Progress:/);
    assert.doesNotMatch(text, /DONE/);
  }
});

test("PDF cache key changes with the ticks, not their order", () => {
  assert.notEqual(pdfKeyOf({ doneSteps: [1] }), pdfKeyOf({ doneSteps: [1, 2] }));
  assert.equal(pdfKeyOf({ doneSteps: [2, 1] }), pdfKeyOf({ doneSteps: [1, 2] }));
  assert.notEqual(pdfKeyOf({}), pdfKeyOf({ doneSteps: [1] }));
});
