/** Crew progress (crewProgress.ts). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { crewProgress, crewProgressDescription, crewProgressLabel } from "@/lib/client/crewProgress";

test("nothing of this crew ticked off shows nothing", () => {
  assert.equal(crewProgress([1, 3], []), null);
  assert.equal(crewProgress([1, 3], [2, 4]), null);
  assert.equal(crewProgress([], [1]), null);
});

test("some steps done names the lowest open step as next", () => {
  const p = crewProgress([2, 4, 5], [4, 1]);
  assert.deepEqual(p, { done: 1, total: 3, next: 2 });
  assert.equal(crewProgressLabel(p!), "1 of 3 done, next step 2");
  assert.equal(
    crewProgressDescription("Volunteers", p!),
    "Volunteers: 1 of 3 steps ticked off as done, 2 to go. Next is step 2.",
  );
});

test("next ignores order of the input lists", () => {
  assert.deepEqual(crewProgress([5, 2, 4], [2]), { done: 1, total: 3, next: 4 });
});

test("every step done says All done (Done for a single step)", () => {
  const all = crewProgress([1, 3], [3, 1, 2]);
  assert.deepEqual(all, { done: 2, total: 2, next: null });
  assert.equal(crewProgressLabel(all!), "All done");
  assert.equal(crewProgressDescription("Painter", all!), "Painter: every step is ticked off as done.");
  assert.equal(crewProgressLabel(crewProgress([1], [1])!), "Done");
});
