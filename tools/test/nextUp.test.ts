/** Next up card logic (nextUp.ts). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { alsoReadyLine, nextUp, nextUpHours, nextUpProgress } from "@/lib/client/nextUp";

const steps = [
  { order: 1 },
  { order: 2, dependsOn: 1 },
  { order: 3 },
  { order: 4, dependsOn: 3 },
];

test("nothing ticked or no steps: no card", () => {
  assert.equal(nextUp(steps, []), null);
  assert.equal(nextUp([], [1]), null);
  assert.equal(nextUp(steps, [9]), null);
});

test("next is the lowest open step whose wait-for step is done", () => {
  const n = nextUp(steps, [1]);
  assert.deepEqual(n, { kind: "next", order: 2, waitingOn: null, done: 1, total: 4, alsoReady: 1 });
  assert.equal(nextUpProgress(n!), "1 of 4 steps done.");
});

test("a step waiting on an open step is skipped for a ready one", () => {
  const n = nextUp(steps, [3]);
  assert.equal(n?.kind, "next");
  assert.equal(n && n.kind === "next" ? n.order : 0, 1);
  const m = nextUp([{ order: 1 }, { order: 2, dependsOn: 3 }, { order: 3 }], [1]);
  assert.equal(m && m.kind === "next" ? m.order : 0, 3);
});

test("a loop in the plan names the first open step and what it waits on", () => {
  const n = nextUp([{ order: 1 }, { order: 2, dependsOn: 3 }, { order: 3, dependsOn: 2 }], [1]);
  assert.deepEqual(n, { kind: "next", order: 2, waitingOn: 3, done: 1, total: 3, alsoReady: 0 });
});

test("all ticked: done card", () => {
  const n = nextUp(steps, [1, 2, 3, 4]);
  assert.deepEqual(n, { kind: "all", total: 4 });
  assert.equal(nextUpProgress(n!), "All 4 steps done.");
  assert.equal(nextUpProgress(nextUp([{ order: 1 }], [1])!), "The step is done.");
});

test("hours and also-ready lines", () => {
  assert.equal(nextUpHours([1, 3]), "About 1-3 h");
  assert.equal(nextUpHours([2, 2]), "About 2 h");
  assert.equal(nextUpHours([3, 1]), null);
  assert.equal(nextUpHours(undefined), null);
  assert.equal(alsoReadyLine(0), "");
  assert.equal(alsoReadyLine(1), "1 other step can start now too.");
  assert.equal(alsoReadyLine(2), "2 other steps can start now too.");
});
