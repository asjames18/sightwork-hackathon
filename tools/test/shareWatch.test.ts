/** Shared text and PDF match the plan screen: ranked problems only, then the coverage note and "Worth a closer look". */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import { MAX_SHARE_WATCH, coverageLine, planToText, watchLine } from "@/lib/client/planText";
import type { WorkPlan } from "@/lib/types";

const DAY = new Date(2026, 9, 31, 9, 0);

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

const frames = [0, 5, 10].map((t, i) => ({ index: i, tSec: t, url: "" }));

function plan(extra: Record<string, unknown> = {}): WorkPlan {
  return {
    spaceName: "Sanctuary",
    generatedFrom: "Walkthrough video, 3 frames, 33 s",
    inventory: [],
    frames,
    issues: [
      { rank: 1, title: "Cable across the stage edge", detail: "", severity: "high", frameIndex: 0, frameTimeSec: 0, unmentioned: true },
      // Marked in place by the server: belongs under "Worth a closer look", not in the count.
      { rank: 2, title: "Scuffed riser", detail: "", severity: "low", frameIndex: 2, frameTimeSec: 10, unmentioned: true, watch: true },
    ],
    watch: [{ title: "Possible water stain on ceiling", detail: "Faint ring above the side aisle.", confidence: 0.42, frameIndex: 1, frameTimeSec: 5, area: "side aisle, ceiling", evidence: "brown ring on a ceiling tile" }],
    coverageNote: "Only the stage was filmed; the seating was not in the frames.",
    materials: [],
    workOrder: [{ order: 1, title: "Tape down the cable", detail: "", fixes: [1] }],
    afterImageUrl: null,
    transcript: null,
    ...extra,
  } as unknown as WorkPlan;
}

test("coverageLine uses the plan screen's lead-in and counts ranked problems only", () => {
  assert.equal(coverageLine(plan()), "Why only one problem: Only the stage was filmed; the seating was not in the frames.");
  assert.equal(coverageLine(plan({ coverageNote: undefined })), null);
  assert.match(coverageLine(plan({ issues: [] }))!, /^Why no problems: /);
});

test("watchLine: title, then where and how sure", () => {
  assert.equal(watchLine({ title: "Loose tile", area: "side aisle", confidence: 0.4 }), "Loose tile (side aisle, 40% sure)");
  assert.equal(watchLine({ title: "Loose tile" }), "Loose tile");
});

test("shared text: the count and list skip watch items, which get their own short list after the note", () => {
  const t = planToText(plan(), { date: DAY });
  assert.match(t, /\n1 problem\.\n/);
  assert.ok(!/^\d+\. Scuffed riser/m.test(t), "watch item is not a numbered problem");
  assert.ok(t.includes("Why only one problem: Only the stage was filmed"));
  assert.ok(t.includes("Worth a closer look (lower confidence, check in person):"));
  assert.ok(t.includes("- Possible water stain on ceiling (side aisle, ceiling, 42% sure)"));
  assert.ok(t.includes("- Scuffed riser"));
  assert.ok(t.indexOf("Worth a closer look") < t.indexOf("Do the work in this order"));
});

test("shared text: long watch lists are capped with a count of the rest", () => {
  const many = Array.from({ length: MAX_SHARE_WATCH + 3 }, (_, i) => ({ title: `Find ${i + 1}`, detail: "", frameIndex: 0, frameTimeSec: 0 }));
  const t = planToText(plan({ watch: many, issues: [plan().issues[0]] }), { date: DAY });
  assert.ok(t.includes(`- Find ${MAX_SHARE_WATCH}`));
  assert.ok(!t.includes(`- Find ${MAX_SHARE_WATCH + 1}\n`));
  assert.ok(t.includes("- and 3 more"));
});

test("shared text: plans with no watch and no note are unchanged", () => {
  const t = planToText(plan({ watch: undefined, coverageNote: undefined, issues: [plan().issues[0]] }), { date: DAY });
  assert.ok(!t.includes("Worth a closer look"));
  assert.ok(!t.includes("Why only"));
});

test("PDF: ranked count, coverage note, and a Worth a closer look section with every find", () => {
  const text = pdfText(buildPlanPdf(jsPDF, plan(), { date: DAY, compress: false }));
  assert.ok(text.includes("Problems, worst first (1 problem)"));
  assert.ok(text.includes("Why only one problem"));
  assert.ok(text.includes("Worth a closer look (2)"));
  assert.ok(text.includes("Possible water stain on ceiling (side aisle, ceiling, 42% sure)"));
  assert.ok(text.includes("Photo shows: brown ring on a ceiling tile"));
  assert.ok(text.includes("Scuffed riser"));
});

test("PDF: no watch section when there is nothing to watch", () => {
  const text = pdfText(buildPlanPdf(jsPDF, plan({ watch: undefined, issues: [plan().issues[0]] }), { date: DAY, compress: false }));
  assert.ok(!text.includes("Worth a closer look"));
});
