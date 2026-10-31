/** pickHeroFrameIndex input guard: a plan that is not an object, a
 * non-array frames list, or a non-array issues/workOrder list throws a
 * named renderAfter error instead of a raw TypeError from .length,
 * .map, or .filter below. Valid plans are unchanged: an in-range hero
 * still wins, no frames still means null, and the ranked-issue and
 * middle-frame picks still work. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { pickHeroFrameIndex } from "@/lib/pipeline/renderAfter";
import type { WorkPlan } from "@/lib/types";

function plan(over: Record<string, unknown>): WorkPlan {
  return {
    frames: [
      { index: 0, tSec: 0 },
      { index: 1, tSec: 10 },
      { index: 2, tSec: 20 },
    ],
    issues: [{ rank: 1, frameIndex: 2 }],
    workOrder: [{ order: 1, title: "Repaint the wall", detail: "", fixes: [1] }],
    ...over,
  } as unknown as WorkPlan;
}

describe("pickHeroFrameIndex input guard", () => {
  test("a plan that is not an object throws a named renderAfter error", () => {
    assert.throws(
      () => (pickHeroFrameIndex as (p: unknown) => unknown)(null),
      /renderAfter: plan must be an object/,
    );
    assert.throws(
      () => (pickHeroFrameIndex as (p: unknown) => unknown)("not a plan"),
      /renderAfter: plan must be an object/,
    );
  });

  test("non-array frames throw a named renderAfter error", () => {
    assert.throws(
      () => pickHeroFrameIndex(plan({ frames: "nope" })),
      /renderAfter: plan.frames must be an array when given/,
    );
  });

  test("non-array issues or workOrder throw a named renderAfter error", () => {
    assert.throws(
      () => pickHeroFrameIndex(plan({ issues: null })),
      /renderAfter: plan.issues must be an array/,
    );
    assert.throws(
      () => pickHeroFrameIndex(plan({ workOrder: "nope" })),
      /renderAfter: plan.workOrder must be an array/,
    );
  });

  test("valid plans are unchanged: in-range hero, no frames, ranked pick, middle pick", () => {
    assert.equal(pickHeroFrameIndex(plan({ heroFrameIndex: 1 })), 1);
    assert.equal(pickHeroFrameIndex(plan({ frames: [] })), null);
    assert.equal(pickHeroFrameIndex(plan({})), 2);
    assert.equal(
      pickHeroFrameIndex(
        plan({
          workOrder: [{ order: 1, title: "Inspect above the ceiling", detail: "", fixes: [1] }],
        }),
      ),
      1,
    );
  });
});
