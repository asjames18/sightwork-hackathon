/** Save PDF counts carry the same "how it was counted" line as the plan screen's tiles. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import type { WorkPlan } from "@/lib/types";

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

const base = (inventory: WorkPlan["inventory"], extra: Partial<WorkPlan> = {}): WorkPlan => ({
  spaceName: "Hall",
  generatedFrom: "Walkthrough video, 3 frames, 40 s",
  inventory,
  issues: [],
  materials: [],
  workOrder: [],
    afterImageUrl: null,
  ...extra,
}) as WorkPlan;
const build = (p: WorkPlan) => pdfText(buildPlanPdf(jsPDF, p, { date: new Date(2026, 9, 31), compress: false }));

test("SAM-counted items say so, ranges say outlines and model differ, and the footnote says counted", () => {
  const t = build(
    base([
      { label: "chairs", count: 48, confidence: 0.9, method: "sam" },
      { label: "tables", count: 6, confidence: 0.8, method: "sam+model" },
      { label: "speakers", count: 4, confidence: 0.7, method: "sam+model", range: [3, 5] },
    ]),
  );
  assert.match(t, /Counted from SAM 3\.1 outlines/);
  assert.match(t, /SAM 3\.1 outlines and the model agree/);
  assert.match(t, /SAM 3\.1 outlines and the model differ, so a range/);
  assert.match(t, /Counted from the video, from what the camera saw\./);
});

test("skipped outlines never claim SAM, and a low-confidence count asks for a hand check", () => {
  const t = build(base([{ label: "chairs", count: 48, confidence: 0.3, method: "sam" }], { meta: { skipped: { masks: true } } } as Partial<WorkPlan>));
  assert.doesNotMatch(t, /SAM 3\.1/);
  assert.match(t, /Estimated by the model from the frames\. Low confidence, check by hand/);
  assert.match(t, /Exact counts come with outlines\./);
});

test("a count with no method and good confidence gets no extra line", () => {
  const t = build(base([{ label: "chairs", count: 48, confidence: 0.9 }]));
  assert.doesNotMatch(t, /Estimated by the model|SAM 3\.1|check by hand/);
});
