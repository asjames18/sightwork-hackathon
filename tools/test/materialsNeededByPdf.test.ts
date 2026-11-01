/** Save PDF materials: each item's "needed by" step and time, and the "Buy first" line, on the PDF's step schedule. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import type { MaterialItem, WorkPlan, WorkStep } from "@/lib/types";

// Fri Oct 30, 2026, evening: the schedule starts Mon Nov 2, 9 AM.
const DAY = new Date(2026, 9, 30, 18, 0, 0);

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

const steps: WorkStep[] = [
  { order: 1, title: "Make safe", detail: "", fixes: [1], hours: [2, 2] },
  { order: 2, title: "Lights", detail: "", fixes: [2], hours: [4, 4] },
];

function plan(materials: MaterialItem[], workOrder: WorkStep[] = steps): WorkPlan {
  return {
    spaceName: "Fellowship hall",
    generatedFrom: "Walkthrough video, 3 frames, 40 s",
    inventory: [],
    issues: [],
    materials,
    workOrder,
    afterImageUrl: null,
    transcript: null,
    frames: [],
  };
}

const pdf = (p: WorkPlan) => pdfText(buildPlanPdf(jsPDF, p, { date: DAY, compress: false }));

test("PDF says which step needs each material first and when it starts", () => {
  const text = pdf(plan([
    { item: "LED lamp", qty: "6", forIssues: [2] },
    { item: "Cable cover", qty: "2", forIssues: [1] },
    { item: "Gloves", qty: "1 box" },
  ]));
  assert.match(text, /LED lamp.*Needed by step 2, Mon, Nov 2, 11 AM/);
  assert.match(text, /Cable cover.*Needed by step 1, Mon, Nov 2, 9 AM/);
  const gloves = text.indexOf("Gloves");
  assert.ok(gloves > 0);
  assert.ok(!text.slice(gloves).includes("Needed by"), "a material tied to no step gets no line");
});

test("PDF puts the Buy first line above the materials list", () => {
  const text = pdf(plan([
    { item: "LED lamp", qty: "6", forIssues: [2] },
    { item: "Cable cover", qty: "2", forIssues: [1] },
  ]));
  const buy = text.indexOf("Buy first: 1 item for step 1, which starts Mon, Nov 2, 9 AM.");
  assert.ok(buy > text.indexOf("Materials"), "after the heading");
  assert.ok(buy < text.indexOf("LED lamp", text.indexOf("Materials")), "before the first item");
});

test("PDF with no work steps prints no needed-by or Buy first lines", () => {
  const text = pdf(plan([{ item: "LED lamp", qty: "6", forIssues: [2] }], []));
  assert.ok(!text.includes("Needed by"));
  assert.ok(!text.includes("Buy first"));
});
