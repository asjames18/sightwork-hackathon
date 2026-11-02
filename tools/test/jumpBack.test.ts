/** "Back to step N" after an in-plan jump (jumpBack.ts). Pure helpers, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isJumpHref, jumpBackLabel, jumpBackState, nearOrigin } from "@/lib/client/jumpBack";

test("only in-plan problem and step links count as jumps", () => {
  assert.equal(isJumpHref("#problem-3"), true);
  assert.equal(isJumpHref("#step-12"), true);
  for (const h of ["#problems", "#steps", "#plan-top", "/start", "https://example.com/#step-1", "#step-", "#step-1a", "", null, undefined]) {
    assert.equal(isJumpHref(h), false, String(h));
  }
});

test("the label names the card the reader left", () => {
  assert.equal(jumpBackLabel("step-4"), "Back to step 4");
  assert.equal(jumpBackLabel("problem-2"), "Back to problem #2");
  assert.equal(jumpBackLabel("step-07"), "Back to step 7");
});

test("links outside a card get a plain label", () => {
  for (const id of [null, undefined, "", "problems", "plan-top", "step-x"]) {
    assert.equal(jumpBackLabel(id), "Back to where you were", String(id));
  }
});

test("near means within half a screen of the start", () => {
  assert.equal(nearOrigin(1000, 1000, 800), true);
  assert.equal(nearOrigin(1399, 1000, 800), true);
  assert.equal(nearOrigin(1400, 1000, 800), false);
  assert.equal(nearOrigin(500, 1000, 800), false);
  assert.equal(nearOrigin(Number.NaN, 1000, 800), true);
  assert.equal(nearOrigin(0, 1000, 0), true);
});

test("the button waits for the jump to carry the reader away, then hides when they scroll back", () => {
  let s = jumpBackState({ away: false }, 1000, 1000, 800);
  assert.deepEqual(s, { away: false, show: true });
  s = jumpBackState(s, 3000, 1000, 800);
  assert.deepEqual(s, { away: true, show: true });
  s = jumpBackState(s, 2000, 1000, 800);
  assert.deepEqual(s, { away: true, show: true });
  s = jumpBackState(s, 1100, 1000, 800);
  assert.deepEqual(s, { away: true, show: false });
});
