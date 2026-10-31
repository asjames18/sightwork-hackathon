/** Save PDF materials section: the plan screen's "Materials to buy" total and each item's problem refs. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import { materialsSpend, spendLine } from "@/lib/client/materialsList";
import { EXAMPLES } from "@/lib/examples";
import type { MaterialItem, WorkPlan } from "@/lib/types";

const DAY = new Date(2026, 9, 31, 6, 40);

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

function plan(materials: MaterialItem[]): WorkPlan {
  return {
    spaceName: "Fellowship hall",
    generatedFrom: "Walkthrough video, 3 frames, 40 s",
    inventory: [],
    issues: [],
    materials,
    workOrder: [],
    afterImageUrl: null,
    transcript: null,
    frames: [],
  };
}

const pdf = (p: WorkPlan) => pdfText(buildPlanPdf(jsPDF, p, { date: DAY, compress: false }));

test("PDF prints the materials total under the list, in the screen's words", () => {
  const p = plan([
    { item: "LED flood bulbs", qty: "4", unitCost: [12, 20], forIssues: [1] },
    { item: "Carpet tape", qty: "2 rolls", unitCost: [8, 8] },
    { item: "Touch-up paint", qty: "1 quart" },
  ]);
  const text = pdf(p);
  const line = spendLine(materialsSpend(p), { dash: "-" });
  assert.equal(line, "Materials to buy: about $64-$96 for 2 items, materials only. 1 more has no price yet.");
  const at = text.indexOf("Materials to buy: about $64-$96");
  assert.ok(at > text.indexOf("Touch-up paint"), "total sits after the last item");
  assert.ok(at < text.indexOf("Prices are estimates"), "total sits before the estimate note");
});

test("PDF lists which problems each material is for, joined with its note", () => {
  const text = pdf(plan([
    { item: "LED flood bulbs", qty: "4", forIssues: [1, 3], note: "Warm white" },
    { item: "Cable cover", qty: "1", forIssues: [2] },
  ]));
  assert.match(text, /For problems #1, #3\. Warm white/);
  assert.match(text, /For problem #2/);
});

test("PDF shows no total when nothing has a price", () => {
  const text = pdf(plan([{ item: "Touch-up paint", qty: "1 quart" }]));
  assert.ok(!text.includes("Materials to buy"));
  assert.ok(!text.includes("Prices are estimates"));
});

test("example plans render without a materials total when they carry no prices", () => {
  for (const e of EXAMPLES) {
    const text = pdfText(buildPlanPdf(jsPDF, e.plan, { date: DAY, compress: false, example: e }));
    assert.equal(text.includes("Materials to buy"), materialsSpend(e.plan) !== null, e.plan.spaceName);
  }
});
