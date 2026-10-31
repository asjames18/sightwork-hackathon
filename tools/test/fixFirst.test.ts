/** "Start here" card logic (fixFirst.ts). No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixFirst, fixFirstLine } from "@/lib/client/fixFirst";
import type { Issue, WorkStep } from "@/lib/types";

const issue = (rank: number, severity: Issue["severity"], extra: Partial<Issue> = {}): Issue => ({
  rank, title: `Problem ${rank}`, detail: "", severity, frameIndex: 0, frameTimeSec: 0, unmentioned: false, ...extra,
});
const issues = [issue(1, "high"), issue(2, "high"), issue(3, "high"), issue(4, "low")];
const steps: WorkStep[] = [
  { order: 1, title: "Cables", detail: "", fixes: [1, 2], hours: [2, 3], trade: "electrician / AV tech" },
  { order: 2, title: "Handrails", detail: "", fixes: [3], hours: [4, 6], trade: "carpenter" },
  { order: 3, title: "Clean", detail: "", fixes: [4], hours: [2, 3], trade: "volunteers" },
  { order: 4, title: "Paint", detail: "", fixes: [4], dependsOn: 3, hours: [6, 8], trade: "painter" },
];

test("picks the steps that fix the Fix now problems, with hours and trades", () => {
  const f = fixFirst(issues, steps)!;
  assert.deepEqual(f.ranks, [1, 2, 3]);
  assert.deepEqual(f.steps, [1, 2]);
  assert.deepEqual(f.unplanned, []);
  assert.equal(f.hours, "about 6–9 h");
  assert.deepEqual(f.trades, ["Electrician / AV tech", "Carpenter"]);
  assert.equal(f.cost, null);
  assert.equal(fixFirstLine(f), "Start here: steps 1 and 2 of 4 take care of the 3 Fix now problems, about 6–9 h of work.");
});

test("adds the earlier steps a fixing step waits on", () => {
  const f = fixFirst([issue(1, "low"), issue(2, "high")], [
    { order: 1, title: "a", detail: "", fixes: [1] },
    { order: 2, title: "b", detail: "", fixes: [] },
    { order: 3, title: "c", detail: "", fixes: [2], dependsOn: 2, hours: [1, 2] },
    { order: 4, title: "d", detail: "", fixes: [1] },
  ])!;
  assert.deepEqual(f.steps, [2, 3]);
  assert.deepEqual(f.prerequisites, [2]);
  assert.equal(f.hours, "at least 1–2 h");
});

test("explicit tier wins over severity; watch items never count", () => {
  const f = fixFirst([issue(1, "low", { tier: "urgent" }), issue(2, "high", { tier: "soon" }), issue(3, "high", { watch: true })], [
    { order: 1, title: "a", detail: "", fixes: [1] },
    { order: 2, title: "b", detail: "", fixes: [2, 3] },
  ])!;
  assert.deepEqual(f.ranks, [1]);
  assert.deepEqual(f.steps, [1]);
  assert.equal(fixFirstLine(f), "Start here: step 1 of 2 takes care of the 1 Fix now problem.");
});

test("Fix now problems with no step are listed as unplanned", () => {
  const f = fixFirst([issue(1, "high"), issue(2, "high"), issue(3, "low")], [
    { order: 1, title: "a", detail: "", fixes: [1] },
    { order: 2, title: "b", detail: "", fixes: [3] },
  ])!;
  assert.deepEqual(f.unplanned, [2]);
});

test("null when nothing to single out", () => {
  assert.equal(fixFirst([issue(1, "low")], steps), null, "no urgent problem");
  assert.equal(fixFirst([issue(1, "high")], [{ order: 1, title: "a", detail: "", fixes: [2] }, { order: 2, title: "b", detail: "" }]), null, "no fixing step");
  assert.equal(fixFirst([issue(1, "high")], [{ order: 1, title: "a", detail: "", fixes: [1] }]), null, "would be the whole plan");
  assert.equal(fixFirst([issue(1, "high")], []), null, "no steps");
});

test("dependency loops and forward links never hang or add later steps", () => {
  const f = fixFirst([issue(1, "high")], [
    { order: 1, title: "a", detail: "", dependsOn: 2 },
    { order: 2, title: "b", detail: "", fixes: [1], dependsOn: 2 },
    { order: 3, title: "c", detail: "", dependsOn: 2 },
  ])!;
  assert.deepEqual(f.steps, [2]);
});

test("cost: step shares when every chosen step has one, else issue shares, else none", () => {
  const stepsMap = new Map([[1, { key: 1, low: 100, high: 150 }], [2, { key: 2, low: 200, high: 300 }]]);
  const f = fixFirst(issues, steps, { steps: stepsMap })!;
  assert.deepEqual(f.cost, { low: 300, high: 450 });
  assert.match(fixFirstLine(f), /about \$300–\$450 of the estimate\.$/);
  const partial = new Map([[1, { key: 1, low: 100, high: 150 }]]);
  const issueMap = new Map([1, 2, 3].map((k) => [k, { key: k, low: 10, high: 20 }]));
  assert.deepEqual(fixFirst(issues, steps, { steps: partial, issues: issueMap })!.cost, { low: 30, high: 60 });
  assert.equal(fixFirst(issues, steps, { steps: partial })!.cost, null);
});

test("bad hours are skipped, and trades merge case-insensitively", () => {
  const f = fixFirst([issue(1, "high"), issue(2, "high")], [
    { order: 1, title: "a", detail: "", fixes: [1], hours: [Number.NaN, 2] as [number, number], trade: "Painter" },
    { order: 2, title: "b", detail: "", fixes: [2], hours: [1, 1], trade: " painter " },
    { order: 3, title: "c", detail: "" },
  ])!;
  assert.equal(f.hours, "at least 1 h");
  assert.deepEqual(f.trades, ["Painter"]);
});
