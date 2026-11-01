/** Problems fixed tally (problemsFixed.ts). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { problemsFixed } from "@/lib/client/problemsFixed";
import type { WorkStep } from "@/lib/types";

const step = (order: number, fixes?: number[]): WorkStep => ({ order, title: `Step ${order}`, detail: "", fixes });
const issues = [{ rank: 1 }, { rank: 2 }, { rank: 3 }, { rank: 4 }];
const work = [step(1, [1]), step(2, [2, 3]), step(3, [3]), step(4)];

test("nothing ticked off shows no tally", () => {
  assert.equal(problemsFixed(issues, work, []), null);
});

test("a problem counts as fixed only when every step that fixes it is done", () => {
  const t = problemsFixed(issues, work, [2]);
  assert.ok(t);
  assert.equal(t.fixed, 1); // #2 (step 2 only); #3 still needs step 3
  assert.equal(t.total, 3); // #4 has no step
  assert.equal(t.untracked, 1);
  assert.equal(t.line, "1 of 3 problems fixed");
  assert.equal(t.percent, 33);
});

test("all fixed reads as a finished line", () => {
  const t = problemsFixed(issues, work, [1, 2, 3]);
  assert.equal(t?.line, "All 3 problems fixed");
  assert.equal(t?.percent, 100);
});

test("a single tracked problem reads naturally", () => {
  assert.equal(problemsFixed([{ rank: 1 }], [step(1, [1])], [1])?.line, "Problem fixed");
  assert.equal(problemsFixed([{ rank: 1 }], [step(1, [1]), step(2)], [2])?.line, "0 of 1 problem fixed");
});

test("no step fixes any problem: no tally even with ticks", () => {
  assert.equal(problemsFixed(issues, [step(1), step(2)], [1]), null);
});

test("ticks for a step that fixes nothing still show the tally at zero", () => {
  const t = problemsFixed(issues, work, [4]);
  assert.equal(t?.line, "0 of 3 problems fixed");
  assert.equal(t?.percent, 0);
});
