/** "Along your walk" timeline logic (walkTimeline.ts). No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { markLabel, markText, walkLengthSec, walkSummary, walkTimeline } from "@/lib/client/walkTimeline";
import { findExample } from "@/lib/examples";
import { rankedIssues } from "@/lib/planExtras";
import type { Issue, WorkPlan } from "@/lib/types";

const issue = (rank: number, t: number, extra: Partial<Issue> = {}): Issue => ({
  rank, title: `P${rank}`, detail: "", severity: "medium", frameIndex: 0, frameTimeSec: t, unmentioned: false, ...extra,
});
const plan = (issues: Issue[], generatedFrom = "Walkthrough video, 8 frames, 60 s, narrated"): WorkPlan => ({
  spaceName: "Room", generatedFrom, inventory: [], issues, materials: [], workOrder: [], afterImageUrl: null, transcript: null,
});

test("walk length comes from generatedFrom, or the latest time in the plan", () => {
  assert.equal(walkLengthSec(plan([issue(1, 10)])), 60);
  assert.equal(walkLengthSec(plan([issue(1, 10), issue(2, 71)])), 71);
  const p = plan([issue(1, 10)], "Walkthrough video");
  p.frames = [{ index: 0, tSec: 30, url: "/a.jpg" }];
  p.transcriptTurns = [{ startSec: 40, endSec: 52, text: "hi" }];
  assert.equal(walkLengthSec(p), 52);
});

test("places problems in walk order, merges close ones, keeps the worst tier", () => {
  const issues = [issue(1, 50, { severity: "high", unmentioned: true }), issue(2, 10), issue(3, 12, { severity: "low" }), issue(4, 30)];
  const t = walkTimeline(plan(issues), issues, true)!;
  assert.deepEqual(t.marks.map((m) => m.ranks), [[2, 3], [4], [1]]);
  assert.deepEqual(t.marks.map((m) => m.tier), ["soon", "soon", "urgent"]);
  assert.deepEqual(t.marks.map((m) => m.unsaid), [false, false, true]);
  assert.equal(t.marks[1].pct, 50);
  assert.equal(t.seen, 4);
  assert.equal(t.unsaid, 1);
  assert.equal(walkSummary(t), "4 problems spotted across the 60 s walk, 1 of them never mentioned.");
});

test("markers never sit past the ends of the bar", () => {
  const issues = [issue(1, 0), issue(2, 60)];
  const t = walkTimeline(plan(issues), issues, false)!;
  assert.deepEqual(t.marks.map((m) => m.pct), [4, 96]);
});

test("said ticks only on narrated walks; said-but-not-seen problems get a tick and no marker", () => {
  const issues = [
    issue(1, 20, { status: "mentioned", mention: { quote: "the rail", saidAtSec: 18 } }),
    issue(2, 40, { status: "mentioned_not_seen", mention: { quote: "the roof", saidAtSec: 5 } }),
  ];
  const t = walkTimeline(plan(issues), issues, true)!;
  assert.deepEqual(t.marks.map((m) => m.ranks), [[1]]);
  assert.deepEqual(t.said.map((s) => [s.rank, s.atSec]), [[2, 5], [1, 18]]);
  assert.equal(walkTimeline(plan(issues), issues, false)!.said.length, 0);
});

test("without narration nothing is called never mentioned", () => {
  const issues = [issue(1, 20, { unmentioned: true }), issue(2, 40, { unmentioned: true })];
  const t = walkTimeline(plan(issues), issues, false)!;
  assert.equal(t.unsaid, 0);
  assert.ok(t.marks.every((m) => !m.unsaid));
  assert.equal(walkSummary(t), "2 problems spotted across the 60 s walk.");
});

test("no timeline for a single photo, a very short clip, or no problems", () => {
  const same = [issue(1, 0), issue(2, 0)];
  assert.equal(walkTimeline(plan(same, "one stock photo"), same, false), null);
  assert.equal(walkTimeline(plan([issue(1, 2)], "clip, 3 s"), [issue(1, 2)], false), null);
  assert.equal(walkTimeline(plan([]), [], true), null);
});

test("summary wording when every problem went unsaid, and marker labels", () => {
  const one = [issue(1, 20, { unmentioned: true })];
  assert.equal(walkSummary(walkTimeline(plan(one), one, true)!), "1 problem spotted across the 60 s walk, and it was never mentioned.");
  assert.equal(markLabel({ atSec: 32, pct: 70, ranks: [2, 4], tier: "urgent", unsaid: true }, "Fix now"), "Problems 2, 4: seen at 32 s, Fix now, never mentioned");
  assert.equal(markLabel({ atSec: 9.6, pct: 20, ranks: [5], tier: "later", unsaid: false }, "Can wait"), "Problem 5: seen at 10 s, Can wait");
});

test("the real sanctuary run (no narration): 4 problems across 44 s, nothing called unsaid", () => {
  const p = findExample("sanctuary").plan;
  const t = walkTimeline(p, rankedIssues(p), false)!;
  assert.equal(t.lengthSec, 44);
  assert.deepEqual(t.marks.map((m) => m.ranks), [[3], [2, 4], [1]]);
  assert.equal(walkSummary(t), "4 problems spotted across the 44 s walk.");
  assert.deepEqual(t.marks.map(markText), ["3", "2, 4", "1"]);
});

test("hand-written single-photo samples get no timeline", () => {
  for (const id of ["classroom", "office", "warehouse"]) {
    const p = findExample(id).plan;
    assert.equal(walkTimeline(p, rankedIssues(p), false), null, id);
  }
});
