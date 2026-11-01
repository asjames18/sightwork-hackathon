/** Problems list filter (problemFilter.ts). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeProblemFilter, filterProblems, problemFilterAnnouncement, problemFilterOptions } from "@/lib/client/problemFilter";
import type { WorkStep } from "@/lib/types";

const step = (order: number, fixes?: number[]): WorkStep => ({ order, title: `Step ${order}`, detail: "", fixes });
const issues = [
  { rank: 1, unmentioned: true },
  { rank: 2, unmentioned: false },
  { rank: 3, unmentioned: true },
  { rank: 4, unmentioned: false },
];
const workOrder = [step(1, [1]), step(2, [2, 3]), step(3, [3]), step(4)];

test("nothing narrows: no options, so the toggle hides", () => {
  assert.deepEqual(problemFilterOptions(issues, { narrated: false, workOrder, done: [] }), []);
});

test("a narrated walk offers You didn't mention with its count", () => {
  const opts = problemFilterOptions(issues, { narrated: true, workOrder, done: [] });
  assert.deepEqual(opts.map((o) => [o.mode, o.count]), [["all", 4], ["unmentioned", 2]]);
});

test("Still to fix appears once a problem is fixed, and counts problems with no step as still open", () => {
  const ctx = { narrated: false, workOrder, done: [2] }; // fixes #2 only; #3 also needs step 3; #4 has no step
  const opts = problemFilterOptions(issues, ctx);
  assert.deepEqual(opts.map((o) => [o.mode, o.label, o.count]), [["all", "All", 4], ["open", "Still to fix", 3]]);
  assert.deepEqual(filterProblems(issues, "open", ctx).map((i) => i.rank), [1, 3, 4]);
});

test("a tick that fixes nothing on its own offers no Still to fix", () => {
  const opts = problemFilterOptions(issues, { narrated: false, workOrder, done: [3] });
  assert.deepEqual(opts, []);
});

test("Still to fix drops out when every problem is fixed", () => {
  const two = [{ rank: 1 }, { rank: 2 }];
  const opts = problemFilterOptions(two, { narrated: false, workOrder, done: [1, 2] });
  assert.deepEqual(opts, []);
  assert.equal(activeProblemFilter("open", opts), "all");
});

test("both narrowing options sit side by side after All", () => {
  const opts = problemFilterOptions(issues, { narrated: true, workOrder, done: [1] });
  assert.deepEqual(opts.map((o) => o.mode), ["all", "unmentioned", "open"]);
  assert.equal(activeProblemFilter("unmentioned", opts), "unmentioned");
});

test("unmentioned on an un-narrated walk keeps every problem", () => {
  assert.equal(filterProblems(issues, "unmentioned", { narrated: false, workOrder, done: [] }).length, 4);
});

test("screen-reader line names the choice", () => {
  const opts = problemFilterOptions(issues, { narrated: true, workOrder, done: [2] });
  assert.equal(problemFilterAnnouncement("all", opts), "Showing all 4 problems.");
  assert.equal(problemFilterAnnouncement("open", opts), "Showing 3 of 4 problems: the ones not fixed yet.");
  assert.equal(problemFilterAnnouncement("unmentioned", opts), "Showing 2 of 4 problems: the ones you didn't mention.");
});
