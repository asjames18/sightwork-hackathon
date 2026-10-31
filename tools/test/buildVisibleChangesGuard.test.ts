/** buildVisibleChanges input guard: a plan that is not an object, or a
 * non-array issues/workOrder list, throws a named renderAfter error
 * instead of a raw TypeError from .filter below. Valid plans are
 * unchanged: a hero-frame issue's visible steps list their titles,
 * a proof-frame match counts, no match means empty, and duplicate
 * step titles collapse to one line. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildVisibleChanges } from "@/lib/pipeline/renderAfter";
import type { WorkPlan } from "@/lib/types";

function plan(over: Record<string, unknown>): WorkPlan {
  return {
    frames: [
      { index: 0, tSec: 0 },
      { index: 1, tSec: 10 },
      { index: 2, tSec: 20 },
    ],
    issues: [{ rank: 1, frameIndex: 1, proofFrames: [] }],
    workOrder: [{ order: 1, title: "Repaint the wall", detail: "", fixes: [1] }],
    ...over,
  } as unknown as WorkPlan;
}

describe("buildVisibleChanges input guard", () => {
  test("a plan that is not an object throws a named renderAfter error", () => {
    assert.throws(
      () => (buildVisibleChanges as (p: unknown, h: number) => unknown)(null, 1),
      /renderAfter: plan must be an object/,
    );
    assert.throws(
      () => (buildVisibleChanges as (p: unknown, h: number) => unknown)("not a plan", 1),
      /renderAfter: plan must be an object/,
    );
  });

  test("non-array issues or workOrder throw a named renderAfter error", () => {
    assert.throws(
      () => buildVisibleChanges(plan({ issues: null }), 1),
      /renderAfter: plan.issues must be an array/,
    );
    assert.throws(
      () => buildVisibleChanges(plan({ workOrder: "nope" }), 1),
      /renderAfter: plan.workOrder must be an array/,
    );
  });

  test("valid plans are unchanged: hero frame, proof frame, no match, dedupe", () => {
    assert.deepEqual(buildVisibleChanges(plan({}), 1), ["Repaint the wall"]);
    assert.deepEqual(
      buildVisibleChanges(
        plan({
          issues: [{ rank: 1, frameIndex: 0, proofFrames: [{ frameIndex: 2 }] }],
        }),
        2,
      ),
      ["Repaint the wall"],
    );
    assert.deepEqual(buildVisibleChanges(plan({}), 9), []);
    assert.deepEqual(
      buildVisibleChanges(
        plan({
          workOrder: [
            { order: 1, title: "Repaint the wall", detail: "", fixes: [1] },
            { order: 2, title: "Repaint the wall", detail: "", fixes: [1] },
          ],
        }),
        1,
      ),
      ["Repaint the wall"],
    );
  });
});
