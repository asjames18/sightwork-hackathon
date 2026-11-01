/** Save PDF materials: items ticked as in hand are marked, drop out of "Buy first" and the spend line (real plans only). No network. */
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
];

const plan: WorkPlan = {
  spaceName: "Fellowship hall",
  generatedFrom: "Walkthrough video, 3 frames, 40 s",
  inventory: [],
  issues: [issue(1, "Loose cable"), issue(2, "Dead bulbs")],
  materials: [
    { item: "Cable cover", qty: "1", unitCost: [20, 20], forIssues: [1] },
    { item: "LED bulbs", qty: "4", unitCost: [5, 5], forIssues: [2] },
  ],
  workOrder: steps,
  afterImageUrl: null,
  transcript: null,
  frames: [],
};

const pdf = (opts: PlanPdfOptions = {}) => pdfText(buildPlanPdf(jsPDF, plan, { date: DAY, compress: false, ...opts }));

test("nothing in hand: no in-hand marks, full spend line", () => {
  const text = pdf();
  assert.doesNotMatch(text, /IN HAND|in hand\./);
  assert.match(text, /Materials to buy: about \$40 for 2 items/);
});

test("one item in hand: tally, its mark, and the spend line counts only the rest", () => {
  const text = pdf({ gotMaterials: [0] });
  assert.match(text, /1 of 2 items in hand\./);
  assert.equal(text.match(/IN HAND/g)?.length, 1);
  assert.match(text, /Still to buy: about \$20 for 1 item/);
  // The in-hand item no longer gets a "Needed by" line; the other one still does.
  assert.equal(text.match(/Needed by step/g)?.length, 1);
  assert.match(text, /Buy first: 1 item for step 2,/);
});

test("everything in hand: all-in-hand tally, no spend line, bad indexes ignored", () => {
  const text = pdf({ gotMaterials: [1, 0, 0, 7, -1] });
  assert.match(text, /All 2 items in hand\./);
  assert.equal(text.match(/IN HAND/g)?.length, 2);
  assert.doesNotMatch(text, /Still to buy|Materials to buy/);
});

test("samples and examples never show in-hand marks", () => {
  assert.doesNotMatch(pdf({ sample: true, gotMaterials: [0] }), /IN HAND/);
  assert.doesNotMatch(pdf({ example: { kind: "real", banner: "Example" }, gotMaterials: [0] }), /IN HAND/);
});

test("cache key follows the in-hand items", () => {
  assert.notEqual(pdfKeyOf({ gotMaterials: [0] }), pdfKeyOf({ gotMaterials: [0, 1] }));
  assert.equal(pdfKeyOf({ gotMaterials: [1, 0] }), pdfKeyOf({ gotMaterials: [0, 1] }));
  assert.notEqual(pdfKeyOf({ gotMaterials: [] }), pdfKeyOf({ gotMaterials: [0] }));
});
