/** Save PDF problem cards: which step fixes each problem, and a FIXED tag once those steps are ticked off. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf, type PlanPdfOptions } from "@/lib/client/planPdf";
import { problemFixTag } from "@/lib/client/problemsFixed";
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
  { order: 2, title: "Lights", detail: "", fixes: [2, 3] },
  { order: 3, title: "Paint", detail: "", fixes: [3] },
];

const plan: WorkPlan = {
  spaceName: "Fellowship hall",
  generatedFrom: "Walkthrough video, 3 frames, 40 s",
  inventory: [],
  issues: [issue(1, "Loose cable"), issue(2, "Dead bulbs"), issue(3, "Scuffed wall"), issue(4, "Odd smell")],
  materials: [],
  workOrder: steps,
  afterImageUrl: null,
  transcript: null,
  frames: [],
};

const pdf = (opts: PlanPdfOptions = {}) => pdfText(buildPlanPdf(jsPDF, plan, { date: DAY, compress: false, ...opts }));

test("problemFixTag: step list, done state, and no tag when no step fixes it", () => {
  assert.deepEqual(problemFixTag(steps, 1, []), { text: "Fixed in step 1", fixed: false });
  assert.deepEqual(problemFixTag(steps, 3, [2]), { text: "Fixed in steps 2 and 3", fixed: false });
  assert.deepEqual(problemFixTag(steps, 3, [3, 2]), { text: "Fixed: steps 2 and 3 ticked off", fixed: true });
  assert.deepEqual(problemFixTag(steps, 1, [1]), { text: "Fixed: step 1 ticked off", fixed: true });
  assert.equal(problemFixTag(steps, 4, [1, 2, 3]), null);
  assert.equal(problemFixTag([], 1, [1]), null);
});

test("no ticks: each card says which step fixes it, nothing marked fixed", () => {
  const text = pdf();
  assert.match(text, /FIXED IN STEP 1/);
  assert.match(text, /FIXED IN STEP 2/);
  assert.match(text, /FIXED IN STEPS 2 AND 3/);
  assert.doesNotMatch(text, /TICKED OFF/);
});

test("ticked steps mark only the problems whose fixing steps are all done", () => {
  const text = pdf({ doneSteps: [1, 2] });
  assert.match(text, /FIXED: STEP 1 TICKED OFF/);
  assert.match(text, /FIXED: STEP 2 TICKED OFF/);
  assert.match(text, /FIXED IN STEPS 2 AND 3/);
  assert.equal(text.match(/TICKED OFF/g)?.length, 2);
  // Existing step Done marks are unchanged (the card tag never says DONE).
  assert.equal(text.match(/DONE/g)?.length, 2);
});

test("sample and example PDFs only say which step fixes each problem", () => {
  for (const opts of [{ sample: true }, { example: { kind: "real" as const, banner: "Real run kept as an example" } }]) {
    const text = pdf({ ...opts, doneSteps: [1, 2, 3] });
    assert.match(text, /FIXED IN STEP 1/);
    assert.doesNotMatch(text, /TICKED OFF/);
  }
});
