/** Save PDF carries the plan screen's "Who does the work" lines, in the same words. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import { crewSummary, showCrewSummary } from "@/lib/client/crewSummary";
import { EXAMPLES } from "@/lib/examples";
import type { WorkPlan, WorkStep } from "@/lib/types";

const DAY = new Date(2026, 9, 31, 5, 40);

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

const step = (order: number, trade: string | undefined, hours?: [number, number]): WorkStep => ({ order, title: `Step title ${order}`, detail: "Do it.", trade, hours });

function plan(workOrder: WorkStep[]): WorkPlan {
  return {
    spaceName: "Fellowship hall",
    generatedFrom: "Walkthrough video, 3 frames, 40 s",
    inventory: [],
    issues: [],
    materials: [],
    workOrder,
    afterImageUrl: null,
    transcript: null,
    frames: [],
  };
}

const pdf = (p: WorkPlan) => pdfText(buildPlanPdf(jsPDF, p, { date: DAY, compress: false }));

test("PDF puts the crew lines under the work steps heading, before step 1", () => {
  const text = pdf(plan([step(1, "Electrician", [2, 3]), step(2, "volunteers", [1, 2]), step(3, "Electrician", [1, 1]), step(4, undefined)]));
  const head = text.indexOf("Do the work in this order");
  const crew = text.indexOf("WHO DOES THE WORK");
  assert.ok(head >= 0 && crew > head, "crew block follows the heading");
  assert.ok(crew < text.indexOf("Step title 1"), "crew block comes before the first step");
  for (const want of [
    "Paid \u00B7 Electrician",
    "Steps 1 and 3, about 3\u20134 h",
    "Free \u00B7 Volunteers",
    "Step 2, about 1\u20132 h",
    "Not assigned yet",
    "Step 4",
    "All 4 steps: at least 4\u20136 h of work in total, before any waiting between steps.",
  ]) {
    assert.ok(text.includes(want.replace(/\u2013/g, "-")) || text.includes(want), `missing: ${want}`);
  }
});

test("PDF leaves the crew lines out when there is only one group, like the plan screen", () => {
  const p = plan([step(1, "Painter", [2, 3]), step(2, "painter", [1, 1])]);
  assert.equal(showCrewSummary(crewSummary(p.workOrder)), false);
  const text = pdf(p);
  assert.ok(text.includes("Do the work in this order"));
  assert.ok(!text.includes("WHO DOES THE WORK"));
});

test("examples with two or more crews carry the block into their PDF", () => {
  const multi = EXAMPLES.filter((e) => showCrewSummary(crewSummary(e.plan.workOrder)));
  assert.ok(multi.length > 0, "at least one example has two or more crews");
  for (const e of multi) {
    const text = pdfText(buildPlanPdf(jsPDF, e.plan, { date: DAY, compress: false, example: e }));
    assert.ok(text.includes("WHO DOES THE WORK"), `${e.plan.spaceName} PDF has the crew block`);
  }
});
