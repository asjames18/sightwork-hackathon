/** Save PDF carries the "Since your last walkthrough" comparison on real plans, in the card's words. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import { pdfKeyOf } from "@/lib/client/savePlanPdf";
import type { PlanComparison } from "@/lib/client/planCompare";
import { EXAMPLES } from "@/lib/examples";
import { COST_LABEL, type WorkPlan } from "@/lib/types";

const DAY = new Date(2026, 9, 31, 10, 0);
const HEADING = "Since your last walkthrough";

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

function plan(): WorkPlan {
  return {
    spaceName: "Fellowship hall",
    generatedFrom: "Walkthrough video, 2 frames, 40 s",
    inventory: [{ label: "chairs", count: 40, confidence: 0.8 }],
    issues: [{ rank: 1, title: "Extension cord across the doorway", detail: "Trip hazard.", severity: "high", frameIndex: 0, frameTimeSec: 2, unmentioned: false }],
    materials: [],
    workOrder: [],
    afterImageUrl: null,
    transcript: null,
    frames: [{ index: 0, tSec: 2, url: "/f0.webp" }],
    costRange: { low: 50, high: 90, currency: "USD", label: COST_LABEL, region: "Atlanta, GA", laborBasis: "volunteer", assumptions: [] },
  };
}

const COMPARE: PlanComparison = {
  gone: [{ title: "Loose ceiling tile", tier: "soon" }],
  stillThere: [{ title: "Extension cord across the doorway", tier: "urgent" }],
  newOnes: [
    { title: "Scuffed stage edge", tier: "later" },
    { title: "Burned-out bulb over the exit", tier: "soon" },
  ],
};

test("real plan PDF has the section after the problems and before the counts, with every row and the caution", () => {
  const text = pdfText(buildPlanPdf(jsPDF, plan(), { date: DAY, compress: false, since: { comparison: COMPARE, when: "Oct 30" } }));
  const at = text.indexOf(HEADING);
  assert.ok(at > text.indexOf("Problems, worst first"), "after the problems");
  assert.ok(at < text.indexOf("What's there (approximate)"), "before the counts");
  for (const want of [
    "1 no longer seen, 1 still there, 2 new, compared with the walkthrough of this space on Oct 30.",
    "No longer seen (1)",
    "- Loose ceiling tile (fix soon)",
    "Still there (1)",
    "- Extension cord across the doorway (fix now)",
    "New this time (2)",
    "- Scuffed stage edge (can wait)",
    "- Burned-out bulb over the exit (fix soon)",
    "check the photos before you count one as fixed",
  ]) {
    assert.ok(text.includes(want), `missing: ${want}`);
  }
});

test("no section without a comparison, or when neither walkthrough had a problem", () => {
  assert.ok(!pdfText(buildPlanPdf(jsPDF, plan(), { date: DAY, compress: false })).includes(HEADING));
  const empty = { gone: [], stillThere: [], newOnes: [] };
  assert.ok(!pdfText(buildPlanPdf(jsPDF, plan(), { date: DAY, compress: false, since: { comparison: empty } })).includes(HEADING));
});

test("samples and example plans never get the section, even if handed one", () => {
  assert.ok(!pdfText(buildPlanPdf(jsPDF, plan(), { date: DAY, compress: false, sample: true, since: { comparison: COMPARE } })).includes(HEADING));
  for (const e of EXAMPLES) {
    const text = pdfText(buildPlanPdf(jsPDF, e.plan, { date: DAY, compress: false, example: e, since: { comparison: COMPARE } }));
    assert.ok(!text.includes(HEADING), `${e.plan.spaceName} has no comparison`);
  }
});

test("cache key changes when the comparison arrives or differs, and is stable otherwise", () => {
  const bare = pdfKeyOf({ sample: false, example: null });
  const withIt = pdfKeyOf({ sample: false, example: null, since: { comparison: COMPARE, when: "Oct 30" } });
  assert.notEqual(bare, withIt);
  assert.equal(withIt, pdfKeyOf({ sample: false, example: null, since: { comparison: structuredClone(COMPARE), when: "Oct 30" } }));
  const moved = { ...COMPARE, gone: [], stillThere: [...COMPARE.stillThere, ...COMPARE.gone] };
  assert.notEqual(withIt, pdfKeyOf({ sample: false, example: null, since: { comparison: moved, when: "Oct 30" } }));
  assert.equal(bare, pdfKeyOf({ sample: false, example: null, since: null }));
});
