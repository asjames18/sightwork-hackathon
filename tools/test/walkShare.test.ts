/** "Along your walk" timeline in the shared text and the PDF (walkShareLines, planToText). No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { walkShareLines, walkTextLines } from "@/lib/client/walkTimeline";
import { planToText } from "@/lib/client/planText";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import type { Issue, WorkPlan } from "@/lib/types";

const issue = (rank: number, t: number, extra: Partial<Issue> = {}): Issue => ({
  rank, title: `Problem ${rank}`, detail: "", severity: "medium", frameIndex: 0, frameTimeSec: t, unmentioned: false, ...extra,
});
const plan = (issues: Issue[], generatedFrom = "Walkthrough video, 8 frames, 60 s, narrated"): WorkPlan => ({
  spaceName: "Room", generatedFrom, inventory: [], issues, materials: [], workOrder: [], afterImageUrl: null,
  transcript: "The carpet is torn.",
});

test("summary plus walk order, numbered like the list, never-mentioned marked", () => {
  const issues = [issue(1, 50, { severity: "high", unmentioned: true }), issue(2, 10), issue(3, 12), issue(4, 30)];
  assert.deepEqual(walkShareLines(plan(issues), issues, true), [
    "4 problems spotted across the 60 s walk, 1 of them never mentioned.",
    "In walk order: #2 at 10 s, #3 at 12 s, #4 at 30 s, #1 at 50 s (never mentioned).",
  ]);
});

test("numbers follow list position when ranks skip (a watch item left the list)", () => {
  const issues = [issue(1, 40), issue(3, 8)];
  assert.equal(walkShareLines(plan(issues), issues, true)[1], "In walk order: #2 at 8 s, #1 at 40 s.");
});

test("no narration: no never-mentioned marks", () => {
  const issues = [issue(1, 50, { unmentioned: true }), issue(2, 10)];
  const p = { ...plan(issues), transcript: null };
  assert.deepEqual(walkShareLines(p, issues, false), [
    "2 problems spotted across the 60 s walk.",
    "In walk order: #2 at 10 s, #1 at 50 s.",
  ]);
});

test("one problem: summary only; single photo or short clip: nothing", () => {
  assert.deepEqual(walkShareLines(plan([issue(1, 20)]), [issue(1, 20)], true), ["1 problem spotted across the 60 s walk."]);
  const same = [issue(1, 0), issue(2, 0)];
  assert.deepEqual(walkShareLines(plan(same, "Photo"), same, true), []);
  const short = [issue(1, 1), issue(2, 2)];
  assert.deepEqual(walkShareLines(plan(short, "Walkthrough video, 2 frames, 3 s"), short, true), []);
});

test("shared text carries the walk lines after the problems", () => {
  const issues = [issue(1, 50, { unmentioned: true }), issue(2, 10)];
  const text = planToText(plan(issues), { date: new Date("2026-10-31T12:00:00Z") });
  const lines = text.split("\n");
  const at = lines.indexOf("In walk order: #2 at 10 s, #1 at 50 s (never mentioned).");
  assert.ok(at > lines.findIndex((l) => l.startsWith("2. Problem 2")), text);
  assert.ok(lines.includes("2 problems spotted across the 60 s walk, 1 of them never mentioned."));
});

test("shared text skips the walk lines when every problem was mentioned (the PDF still has them)", () => {
  const issues = [issue(1, 50), issue(2, 10)];
  assert.deepEqual(walkTextLines(plan(issues), issues, true), []);
  assert.equal(walkShareLines(plan(issues), issues, true).length, 2);
  assert.doesNotMatch(planToText(plan(issues), { date: new Date("2026-10-31T12:00:00Z") }), /In walk order/);
});

test("long text drops the counts line, then the walk lines, before cutting the plan", () => {
  const issues = [issue(1, 50, { unmentioned: true }), issue(2, 10)];
  const full = planToText(plan(issues), { date: new Date("2026-10-31T12:00:00Z") });
  const walkLen = "\n2 problems spotted across the 60 s walk, 1 of them never mentioned.\nIn walk order: #2 at 10 s, #1 at 50 s (never mentioned).".length;
  assert.ok(full.includes("In walk order"), full);
  const text = planToText(plan(issues), { date: new Date("2026-10-31T12:00:00Z"), maxChars: full.length - walkLen + 1 });
  assert.ok(!text.includes("In walk order"), text);
  assert.ok(!text.includes("Shortened"), text);
});

test("Save PDF carries the walk lines under the problems, even when every problem was mentioned", () => {
  const raw = (p: WorkPlan) => {
    const b = Buffer.from(buildPlanPdf(jsPDF, p, { date: new Date(2026, 9, 31), compress: false }).output("arraybuffer")).toString("latin1");
    return [...b.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) => m[1].replace(/\\(.)/g, "$1")).join(" ").replace(/\s+/g, " ");
  };
  const said = [issue(1, 50), issue(2, 10)];
  assert.match(raw(plan(said)), /In walk order: #2 at 10 s, #1 at 50 s\./);
  const unsaid = [issue(1, 50, { unmentioned: true }), issue(2, 10)];
  const t = raw(plan(unsaid));
  assert.match(t, /2 problems spotted across the 60 s walk, 1 of them never mentioned\./);
  assert.match(t, /#1 at 50 s \(never mentioned\)/);
});
