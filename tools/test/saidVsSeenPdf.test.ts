/** Save PDF carries the plan screen's "What you said vs. what we saw" rows, in the same words. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import { SAID_VS_SEEN_HEADING, saidVsSeenLines } from "@/lib/client/planText";
import { EXAMPLES } from "@/lib/examples";
import { COST_LABEL, type WorkPlan } from "@/lib/types";

const DAY = new Date(2026, 9, 31, 4, 0);

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

function plan(extra: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Fellowship hall",
    generatedFrom: "Walkthrough video, 3 frames, 40 s, narrated",
    inventory: [],
    issues: [
      { rank: 1, title: "Extension cord across the doorway", detail: "Trip hazard.", severity: "high", frameIndex: 0, frameTimeSec: 2, unmentioned: true },
      { rank: 2, title: "Ceiling tile stain", detail: "Brown ring.", severity: "medium", frameIndex: 1, frameTimeSec: 20, unmentioned: false },
    ],
    materials: [],
    workOrder: [],
    afterImageUrl: null,
    transcript: "[0.0] Check the hall.",
    frames: [
      { index: 0, tSec: 2, url: "/f0.webp" },
      { index: 1, tSec: 20, url: "/f1.webp" },
    ],
    saidVsSeen: [
      { status: "mentioned", said: { quote: "That tile  is stained.", atSec: 19.6 }, seen: { summary: "Brown ring on a ceiling tile", frameIndex: 1 }, issueRank: 2 },
      { status: "unmentioned", said: null, seen: { summary: "Cord across the main exit", frameIndex: 0 }, issueRank: 1 },
      { status: "mentioned_not_seen", said: { quote: "The door squeaks.", atSec: 31 }, seen: null },
    ],
    costRange: { low: 120, high: 340, currency: "USD", label: COST_LABEL, region: "Sebring, FL", laborBasis: "volunteer", assumptions: [] },
    ...extra,
  };
}

test("rows read like the plan screen: quote with seconds, 'Not mentioned', 'Not visible in the video'", () => {
  assert.deepEqual(saidVsSeenLines(plan()), [
    { said: "\u201CThat tile is stained.\u201D (20 s)", seen: "Brown ring on a ceiling tile", unmentioned: false, notSeen: false },
    { said: "Not mentioned", seen: "Cord across the main exit", unmentioned: true, notSeen: false },
    { said: "\u201CThe door squeaks.\u201D (31 s)", seen: "Not visible in the video", unmentioned: false, notSeen: true },
  ]);
});

test("no rows without narration or without saidVsSeen, so the section never renders empty", () => {
  assert.deepEqual(saidVsSeenLines(plan({ transcript: null, transcriptTurns: [] })), []);
  assert.deepEqual(saidVsSeenLines(plan({ saidVsSeen: undefined })), []);
  assert.deepEqual(saidVsSeenLines(plan({ saidVsSeen: [] })), []);
});

test("PDF has the section between the problems and the counts, with every row", () => {
  const text = pdfText(buildPlanPdf(jsPDF, plan(), { date: DAY, compress: false }));
  const at = text.indexOf(SAID_VS_SEEN_HEADING);
  assert.ok(at > text.indexOf("Problems, worst first"), "after the problems");
  for (const want of ["SAID", "SEEN", "\"That tile is stained.\" (20 s)", "Brown ring on a ceiling tile", "Not mentioned", "Cord across the main exit", "Not visible in the video"]) {
    assert.ok(text.includes(want), `missing: ${want}`);
  }
});

test("PDF leaves the section out for a silent walk", () => {
  const text = pdfText(buildPlanPdf(jsPDF, plan({ transcript: null, transcriptTurns: [] }), { date: DAY, compress: false }));
  assert.ok(!text.includes(SAID_VS_SEEN_HEADING));
});

test("narrated examples carry the section into their PDF", () => {
  const narrated = EXAMPLES.filter((e) => saidVsSeenLines(e.plan).length > 0);
  assert.ok(narrated.length > 0, "at least one narrated example");
  for (const e of narrated) {
    const text = pdfText(buildPlanPdf(jsPDF, e.plan, { date: DAY, compress: false, example: e }));
    assert.ok(text.includes(SAID_VS_SEEN_HEADING), `${e.plan.spaceName} PDF has the section`);
  }
});
