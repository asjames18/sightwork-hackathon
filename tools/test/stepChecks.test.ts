/** Per-step check notes: deterministic rules, the stream check parser, and the preview runner's check lines. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStepCheck, stepChecksForPlan, transcriptWords, uploadCheck } from "@/lib/stepChecks";
import { withPrecomputedReview } from "@/lib/review";
import { mockPlanJob } from "@/lib/client/planJob";
import type { PlanJobStatus, WorkPlan } from "@/lib/types";

function plan(extra: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Stage",
    generatedFrom: "",
    inventory: [
      { label: "Chair", count: 64, confidence: 0.9, method: "sam" },
      { label: "Speaker", count: 2, confidence: 0.6, method: "model" },
    ],
    issues: [
      { rank: 1, title: "Cable", detail: "", severity: "high", frameIndex: 0, frameTimeSec: 0, unmentioned: true },
      { rank: 2, title: "Steps", detail: "", severity: "medium", frameIndex: 1, frameTimeSec: 6, unmentioned: false },
    ],
    materials: [],
    workOrder: [],
    afterImageUrl: "/after.webp",
    transcript: "[0.0] The booth is plywood.\n[4.2] Steps have no handrail.",
    frames: [
      { index: 0, tSec: 0, url: "/f0.webp" },
      { index: 1, tSec: 6, url: "/f1.webp" },
    ],
    ...extra,
  };
}

test("upload and transcript notes", () => {
  assert.deepEqual(uploadCheck(17, 1), { ok: true, note: "17 frames, 1 swapped for a sharper one" });
  assert.deepEqual(uploadCheck(1), { ok: true, note: "1 frame" });
  assert.equal(uploadCheck(0).ok, false);
  assert.equal(transcriptWords(plan()), 8);
  assert.equal(transcriptWords(plan({ transcriptTurns: [{ startSec: 0, text: "one two  three" }] })), 3);
});

test("stepChecksForPlan: counts, comparing, planning, picturing, reviewing", () => {
  const c = stepChecksForPlan(withPrecomputedReview(plan()));
  assert.deepEqual(c.uploading, { ok: true, note: "2 frames" });
  assert.deepEqual(c.listening, { ok: true, note: "Transcript: 8 words" });
  assert.deepEqual(c.counting, { ok: false, note: "1 count had no outline, marked estimated" });
  assert.deepEqual(c.comparing, { ok: true, note: "1 you mentioned, 1 you didn't" });
  assert.deepEqual(c.planning, { ok: true, note: "Plan: 2 problems, each with a proof frame" });
  assert.deepEqual(c.picturing, { ok: true, note: "After picture made" });
  assert.deepEqual(c.reviewing, { ok: true, note: "2 of 2 problems backed by a photo" });
});

test("stepChecksForPlan: no outlines, no narration, missing proof, review didn't run", () => {
  const c = stepChecksForPlan(
    plan({
      inventory: [{ label: "Chair", count: 3, confidence: 0.5, method: "model" }],
      transcript: null,
      afterImageUrl: null,
      issues: [{ rank: 1, title: "Cable", detail: "", severity: "high", frameIndex: 5, frameTimeSec: 0, unmentioned: true }],
      review: { ran: false, items: [] },
    }),
  );
  assert.equal(c.counting, undefined);
  assert.deepEqual(c.listening, { ok: true, note: "No narration in this video" });
  assert.equal(c.comparing, undefined);
  assert.deepEqual(c.planning, { ok: false, note: "Plan: 0 of 1 problem have a proof frame" });
  assert.equal(c.picturing, undefined);
  assert.deepEqual(c.reviewing, { ok: false, note: "Review didn't run" });
  assert.deepEqual(stepChecksForPlan(plan({ inventory: [{ label: "Chair", count: 3, confidence: 0.9, method: "sam+model" }] })).counting, { ok: true, note: "Counts match the outlines" });
});

test("parseStepCheck trims, caps at 120 chars, rejects bad shapes", () => {
  assert.deepEqual(parseStepCheck({ ok: true, note: "  a  b " }), { ok: true, note: "a b" });
  assert.equal(parseStepCheck({ ok: true, note: "x".repeat(300) })?.note.length, 120);
  assert.equal(parseStepCheck({ ok: true, note: "   " }), null);
  assert.equal(parseStepCheck({ ok: 1, note: "x" }), null);
  assert.equal(parseStepCheck("x"), null);
});

test("preview runner walks every step to reviewing, sends a check after each it can vouch for, ends on a reviewed plan", async () => {
  const seen: PlanJobStatus[] = [];
  const g = globalThis as { setTimeout: typeof setTimeout };
  const real = g.setTimeout;
  g.setTimeout = ((fn: () => void) => real(fn, 0)) as typeof setTimeout;
  try {
    await mockPlanJob({ file: new Blob([]) as File, onStatus: (s) => seen.push(s), signal: new AbortController().signal });
  } finally {
    g.setTimeout = real;
  }
  const running = seen.filter((s): s is Extract<PlanJobStatus, { state: "running" }> => s.state === "running");
  assert.equal(running.filter((s) => !s.check).at(-1)?.step, "reviewing");
  const checked = running.filter((s) => s.check).map((s) => s.step);
  assert.ok(checked.includes("planning") && checked.includes("reviewing"), checked.join(","));
  // The check line for a step always follows that step's own start line.
  for (const [k, s] of running.entries()) if (s.check) assert.equal(running[k - 1].step, s.step);
  const done = seen.at(-1);
  assert.ok(done && done.state === "done" && done.plan.review?.source === "precomputed");
});

test("addCheck keeps the latest check per step and ignores lines without one", async () => {
  const { addCheck } = await import("@/lib/client/usePlanJob");
  let c = addCheck({}, { state: "running", step: "uploading", check: { ok: true, note: "7 frames" } });
  c = addCheck(c, { state: "running", step: "listening" });
  c = addCheck(c, { state: "running", step: "uploading", check: { ok: true, note: "8 frames" } });
  c = addCheck(c, { state: "failed", step: "planning", message: "x" });
  assert.deepEqual(c, { uploading: { ok: true, note: "8 frames" } });
});
