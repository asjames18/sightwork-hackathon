/** A plan with problems but no work steps, on paper: Send to your team text and Save PDF say so honestly. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import { planToText } from "@/lib/client/planText";
import type { Issue, WorkPlan } from "@/lib/types";

const DAY = new Date(2026, 9, 30, 18, 0, 0);

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

const issue = (rank: number, title: string): Issue =>
  ({ rank, title, severity: "medium", detail: "", frameIndex: 0, confidence: 0.9 }) as unknown as Issue;

const base: WorkPlan = {
  spaceName: "Fellowship hall",
  generatedFrom: "Walkthrough video, 3 frames, 40 s",
  inventory: [],
  issues: [issue(1, "Loose cable"), issue(2, "Dead bulbs")],
  materials: [{ item: "Cable cover", qty: "1", unitCost: [20, 20], forIssues: [1] }],
  workOrder: [],
  afterImageUrl: null,
  transcript: null,
  frames: [],
  costRange: null,
  meta: { skipped: { cost: true } },
} as unknown as WorkPlan;

const text = (p: WorkPlan, sample = false) => planToText(p, { sample, date: DAY });
const pdf = (p: WorkPlan, sample = false) => pdfText(buildPlanPdf(jsPDF, p, { date: DAY, compress: false, sample }));

test("share text: problems with no steps get the honest steps line and the no-steps cost line", () => {
  const t = text(base);
  assert.match(t, /This run didn\u2019t lay out work steps for the 2 problems above\./);
  assert.match(t, /No cost range, since there are no work steps to price\./);
  assert.doesNotMatch(t, /Do the work in this order:/);
  assert.doesNotMatch(t, /nothing needs fixing/);
});

test("share text: one problem reads singular; no materials means no cost line", () => {
  const t = text({ ...base, issues: [issue(1, "Loose cable")], materials: [] });
  assert.match(t, /work steps for the problem above\./);
  assert.doesNotMatch(t, /No cost range/);
});

test("share text: samples and plans with steps are unchanged", () => {
  assert.doesNotMatch(text(base, true), /didn\u2019t lay out|No cost range/);
  const withSteps = text({ ...base, workOrder: [{ order: 1, title: "Make safe", detail: "", fixes: [1] }] } as WorkPlan);
  assert.match(withSteps, /Do the work in this order:/);
  assert.doesNotMatch(withSteps, /didn\u2019t lay out|No cost range, since/);
});

test("Save PDF: steps heading carries the honest line and the cost card says there was nothing to price", () => {
  const t = pdf(base);
  assert.match(t, /Do the work in this order/);
  assert.match(t, /lay out work steps for the 2 problems/);
  assert.match(t, /no work steps to price/);
  assert.doesNotMatch(t, /couldn't be worked out/);
});

test("Save PDF: a skipped cost with steps keeps its own line, samples get no no-steps line", () => {
  const withSteps = pdf({ ...base, workOrder: [{ order: 1, title: "Make safe", detail: "", fixes: [1] }] } as WorkPlan);
  assert.match(withSteps, /couldn't be worked out/);
  assert.doesNotMatch(withSteps, /no work steps to price/);
  assert.doesNotMatch(pdf(base, true), /lay out work steps|no work steps to price/);
});
