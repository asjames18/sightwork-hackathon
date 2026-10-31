/** The run-cost sentence from the Powered by Meta panel also reaches the shared text and Save PDF, on real runs only. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import { planToText, SHARE_SIGNOFF } from "@/lib/client/planText";
import type { WorkPlan } from "@/lib/types";

const DAY = new Date(2026, 9, 31, 7, 40);
const LINE = "The AI model calls for this plan cost about 94 cents.";

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

function plan(meta: WorkPlan["meta"]): WorkPlan {
  return {
    spaceName: "Fellowship hall",
    generatedFrom: "Walkthrough video, 3 frames, 40 s",
    inventory: [],
    issues: [],
    materials: [{ item: "Carpet tape", qty: "2 rolls" }],
    workOrder: [],
    afterImageUrl: null,
    transcript: null,
    frames: [],
    meta,
  };
}

const pdf = (p: WorkPlan, opts: { sample?: boolean } = {}) => pdfText(buildPlanPdf(jsPDF, p, { date: DAY, compress: false, ...opts }));

test("shared text puts the run cost just above the sign-off on a real run", () => {
  const t = planToText(plan({ costUsd: 0.94 }));
  assert.ok(t.endsWith(`\n\n${LINE}\n\n${SHARE_SIGNOFF}`), t.slice(-160));
});

test("shared text keeps the sign-off last when shortened", () => {
  const t = planToText(plan({ costUsd: 0.94 }), { maxChars: 120 });
  assert.ok(t.endsWith(SHARE_SIGNOFF));
});

test("shared text has no run cost on samples, examples, or without a usable total", () => {
  for (const [p, opts] of [
    [plan({ costUsd: 0.94 }), { sample: true }],
    [plan({ costUsd: 0.94, isExample: true }), {}],
    [plan(undefined), {}],
    [plan({ costUsd: 0 }), {}],
  ] as const) {
    assert.doesNotMatch(planToText(p, opts), /model calls for this plan cost/);
  }
});

test("Save PDF prints the run cost after the cost section on a real run", () => {
  const text = pdf(plan({ costUsd: 0.94 }));
  const at = text.indexOf(LINE);
  assert.ok(at > 0, "line present");
  assert.ok(at > text.indexOf("What it might cost"), "after the cost section");
});

test("Save PDF has no run cost on samples, examples, or a missing total", () => {
  assert.doesNotMatch(pdf(plan({ costUsd: 0.94 }), { sample: true }), /model calls for this plan cost/);
  assert.doesNotMatch(pdf(plan({ costUsd: 0.94, isExample: true })), /model calls for this plan cost/);
  assert.doesNotMatch(pdf(plan(undefined)), /model calls for this plan cost/);
});
