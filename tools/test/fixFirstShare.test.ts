/** The plan screen's "Start here" sentence also goes in "Send to your team" text and Save PDF. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import { planToText } from "@/lib/client/planText";
import { fixFirstPlanLines, fixFirstUnplannedLine } from "@/lib/client/fixFirst";
import type { Issue, WorkPlan, WorkStep } from "@/lib/types";

const DAY = new Date(2026, 9, 31, 12, 10);

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

const issue = (rank: number, severity: Issue["severity"], extra: Partial<Issue> = {}): Issue => ({
  rank, title: `Problem ${rank}`, detail: "", severity, frameIndex: 0, frameTimeSec: 0, unmentioned: false, ...extra,
});
const steps: WorkStep[] = [
  { order: 1, title: "Cables", detail: "", fixes: [1, 2], hours: [2, 3], trade: "electrician" },
  { order: 2, title: "Handrails", detail: "", fixes: [3], hours: [4, 6], trade: "carpenter" },
  { order: 3, title: "Clean", detail: "", fixes: [4], hours: [2, 3], trade: "volunteers" },
  { order: 4, title: "Paint", detail: "", fixes: [4], dependsOn: 3, hours: [6, 8], trade: "painter" },
];

function plan(issues: Issue[], workOrder: WorkStep[] = steps): WorkPlan {
  return {
    spaceName: "Fellowship hall",
    generatedFrom: "Walkthrough video, 3 frames, 40 s",
    inventory: [],
    issues,
    materials: [],
    workOrder,
    afterImageUrl: null,
    transcript: null,
    frames: [],
  };
}

const LINE = "Start here: steps 1 and 2 of 4 take care of the 3 Fix now problems, about 6–9 h of work.";

test("share text puts the Start here line right before the work order", () => {
  const text = planToText(plan([issue(1, "high"), issue(2, "high"), issue(3, "high"), issue(4, "low")]), { date: DAY });
  const at = text.indexOf(LINE);
  assert.ok(at > 0, text);
  assert.ok(at < text.indexOf("Do the work in this order:"));
  assert.ok(at > text.indexOf("1. Problem 1"), "after the problems");
});

test("no Start here line when no problem is Fix now or the first steps are the whole plan", () => {
  assert.doesNotMatch(planToText(plan([issue(1, "low"), issue(4, "medium")]), { date: DAY }), /Start here/);
  const whole = plan([issue(1, "high")], [{ order: 1, title: "Cables", detail: "", fixes: [1] }]);
  assert.deepEqual(fixFirstPlanLines(whole), []);
  assert.doesNotMatch(planToText(whole, { date: DAY }), /Start here/);
});

test("watch items never count, and an unplanned Fix now problem gets the card's by-hand line", () => {
  const lines = fixFirstPlanLines(plan([issue(1, "high"), issue(2, "high", { watch: true }), issue(5, "high"), issue(4, "low")]));
  assert.equal(lines[0], "Start here: step 1 of 4 takes care of the 2 Fix now problems, about 2–3 h of work.");
  assert.equal(lines[1], "No step covers problem #5 yet, so plan it by hand.");
  assert.equal(
    fixFirstUnplannedLine({ ranks: [1, 5, 6], unplanned: [5, 6], steps: [1], prerequisites: [], totalSteps: 2, hours: null, trades: [], cost: null }),
    "No step covers problem #5 and problem #6 yet, so plan them by hand.",
  );
});

test("Save PDF has the Start here line under the work steps heading, before the crew lines", () => {
  const text = pdfText(buildPlanPdf(jsPDF, plan([issue(1, "high"), issue(2, "high"), issue(3, "high"), issue(4, "low")]), { date: DAY, compress: false }));
  const head = text.indexOf("Do the work in this order");
  const start = text.indexOf("Start here: steps 1 and 2 of 4");
  assert.ok(head >= 0 && start > head, text);
  assert.ok(start < text.indexOf("WHO DOES THE WORK"));
  assert.match(text, /about 6-9 h of work/);
});
