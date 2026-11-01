/** Said-vs-seen headline on paper: the shared text header and the PDF summary name the problems never mentioned. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { planToText, unmentionedHeadline, unmentionedTitlesLine } from "@/lib/client/planText";
import { buildPlanPdf } from "@/lib/client/planPdf";
import type { Issue, WorkPlan } from "@/lib/types";

const issue = (rank: number, title: string, unmentioned: boolean): Issue => ({
  rank, title, detail: "", severity: rank === 1 ? "high" : "medium", frameIndex: rank - 1, frameTimeSec: rank * 5, unmentioned,
  ...(unmentioned ? { proofFrames: [{ frameIndex: rank - 1, tSec: rank * 5 }] } : {}),
});

function plan(extra: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Main sanctuary stage",
    generatedFrom: "Walkthrough video, 3 frames, 40 s, narrated",
    inventory: [],
    issues: [issue(1, "Cable across the steps", true), issue(2, "Loose carpet seam", false), issue(3, "Burned-out stage light", true)],
    materials: [],
    workOrder: [{ order: 1, title: "Cover the cable", detail: "" }],
    afterImageUrl: null,
    transcript: "[0.0] Check the stage.",
    ...extra,
  };
}

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

test("headline counts the problems never mentioned", () => {
  const i = plan().issues;
  assert.equal(unmentionedHeadline(i, true), "2 of 3 never mentioned on the walk, caught on video.");
  assert.equal(unmentionedHeadline([i[0], i[1]], true), "1 of 2 never mentioned on the walk, caught on video.");
  assert.equal(unmentionedHeadline([i[0], i[2]], true), "All 2 never mentioned on the walk, caught on video.");
  assert.equal(unmentionedHeadline([i[0]], true), "Never mentioned on the walk, caught on video.");
});

test("no headline without narration, with nothing unmentioned, or with no problems", () => {
  const i = plan().issues;
  assert.equal(unmentionedHeadline(i, false), null);
  assert.equal(unmentionedHeadline([i[1]], true), null);
  assert.equal(unmentionedHeadline([], true), null);
  assert.equal(unmentionedTitlesLine(i, false), null);
  assert.equal(unmentionedTitlesLine([i[1]], true), null);
});

test("titles line lists the unmentioned problems in the order given", () => {
  assert.equal(unmentionedTitlesLine(plan().issues, true), "Not mentioned: Cable across the steps \u00B7 Burned-out stage light");
});

test("shared text header carries the headline right after the problem count", () => {
  const lines = planToText(plan(), { date: new Date(2026, 9, 31) }).split("\n");
  assert.equal(lines[2], "3 problems, worst first. 2 of 3 never mentioned on the walk, caught on video.");
});

test("shared text header stays plain without narration or unmentioned problems", () => {
  const silent = planToText(plan({ transcript: "" }), { date: new Date(2026, 9, 31) }).split("\n");
  assert.equal(silent[2], "3 problems, worst first.");
  const allSaid = planToText(plan({ issues: [issue(1, "Loose carpet seam", false)] }), { date: new Date(2026, 9, 31) });
  assert.ok(!allSaid.includes("never mentioned on the walk"));
});

test("PDF summary carries the headline and names the unmentioned problems", () => {
  const text = pdfText(buildPlanPdf(jsPDF, plan(), { date: new Date(2026, 9, 31), compress: false, images: { frames: new Map() } }));
  assert.ok(text.includes("2 of 3 never mentioned on the walk, caught on video."), text.slice(0, 400));
  assert.ok(text.includes("Not mentioned: Cable across the steps"));
  const head = text.indexOf("never mentioned on the walk");
  assert.ok(head > -1 && head < text.indexOf("Problems, worst first"), "headline sits in the summary, above the problems");
});

test("PDF without narration has no headline", () => {
  const text = pdfText(buildPlanPdf(jsPDF, plan({ transcript: "" }), { date: new Date(2026, 9, 31), compress: false, images: { frames: new Map() } }));
  assert.ok(!text.includes("never mentioned on the walk"));
  assert.ok(!text.includes("Not mentioned:"));
});
