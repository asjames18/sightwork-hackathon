/** pickFallbackHeroFrameIndex / buildVisibleChanges entry guard: a
 * non-object issues or workOrder entry used to pass the array guards
 * and only fail in the sort or filter, reading rank / frameIndex /
 * fixes off null with a raw TypeError and no entry named. Such entries
 * now throw a named renderAfter error with the index. Valid plans are
 * unchanged: the fallback pick and the visible-changes lines still
 * work. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  pickFallbackHeroFrameIndex,
  buildVisibleChanges,
} from "@/lib/pipeline/renderAfter";
import type { WorkPlan } from "@/lib/types";

function plan(over: Record<string, unknown>): WorkPlan {
  return {
    frames: [
      { index: 0, tSec: 0 },
      { index: 1, tSec: 10 },
      { index: 2, tSec: 20 },
    ],
    issues: [
      { rank: 1, frameIndex: 0 },
      { rank: 2, frameIndex: 1 },
    ],
    workOrder: [
      { order: 1, title: "Repaint the wall", detail: "", fixes: [1] },
      { order: 2, title: "Fix the light", detail: "", fixes: [2] },
    ],
    ...over,
  } as unknown as WorkPlan;
}

describe("pickFallbackHeroFrameIndex entry guard", () => {
  test("a non-object issues entry throws a named renderAfter error with the index", () => {
    assert.throws(
      () => pickFallbackHeroFrameIndex(plan({ issues: [null] }), 0),
      /renderAfter: plan\.issues\[0\] must be an object/,
    );
    assert.throws(
      () =>
        pickFallbackHeroFrameIndex(
          plan({
            issues: [{ rank: 1, frameIndex: 0 }, "nope"],
          }),
          0,
        ),
      /renderAfter: plan\.issues\[1\] must be an object/,
    );
  });

  test("a valid plan still picks the next ranked frame", () => {
    assert.equal(pickFallbackHeroFrameIndex(plan({}), 0), 1);
    assert.equal(pickFallbackHeroFrameIndex(plan({}), 1), 0);
  });
});

describe("buildVisibleChanges entry guard", () => {
  test("a non-object issues entry throws a named renderAfter error with the index", () => {
    assert.throws(
      () => buildVisibleChanges(plan({ issues: [null] }), 1),
      /renderAfter: plan\.issues\[0\] must be an object/,
    );
    assert.throws(
      () =>
        buildVisibleChanges(
          plan({
            issues: [{ rank: 1, frameIndex: 1 }, undefined],
          }),
          1,
        ),
      /renderAfter: plan\.issues\[1\] must be an object/,
    );
  });

  test("a non-object workOrder entry throws a named renderAfter error with the index", () => {
    assert.throws(
      () => buildVisibleChanges(plan({ workOrder: [null] }), 1),
      /renderAfter: plan\.workOrder\[0\] must be an object/,
    );
    assert.throws(
      () =>
        buildVisibleChanges(
          plan({
            workOrder: [
              { order: 1, title: "Repaint the wall", detail: "", fixes: [1] },
              "nope",
            ],
          }),
          1,
        ),
      /renderAfter: plan\.workOrder\[1\] must be an object/,
    );
  });

  test("a valid plan still returns the visible step lines", () => {
    assert.deepEqual(buildVisibleChanges(plan({}), 1), ["Fix the light"]);
    assert.deepEqual(buildVisibleChanges(plan({}), 0), ["Repaint the wall"]);
    assert.deepEqual(buildVisibleChanges(plan({}), 2), []);
  });
});
