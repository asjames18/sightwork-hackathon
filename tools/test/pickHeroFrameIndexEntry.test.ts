/** pickHeroFrameIndex entry guard: a non-object issues or workOrder
 * entry used to pass the array guards and only fail in the ranked
 * pick, reading rank off null in the sort comparator (or fixes off
 * null in the filter) with a raw TypeError and no entry named. Such
 * entries now throw a named renderAfter error with the index. Valid
 * plans are unchanged: the ranked-issue and middle-frame picks still
 * work. No network. */
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

describe("pickHeroFrameIndex entry guard", () => {
  test("a non-object issues entry throws a named renderAfter error with the index", () => {
    assert.throws(
      () => pickHeroFrameIndex(plan({ issues: [null] })),
      /renderAfter: plan\.issues\[0\] must be an object/,
    );
    assert.throws(
      () =>
        pickHeroFrameIndex(
          plan({ issues: [{ rank: 1, frameIndex: 2 }, "nope"] }),
        ),
      /renderAfter: plan\.issues\[1\] must be an object/,
    );
  });

  test("a non-object workOrder entry throws a named renderAfter error with the index", () => {
    assert.throws(
      () => pickHeroFrameIndex(plan({ workOrder: [null] })),
      /renderAfter: plan\.workOrder\[0\] must be an object/,
    );
    assert.throws(
      () =>
        pickHeroFrameIndex(
          plan({
            workOrder: [
              { order: 1, title: "Repaint the wall", detail: "", fixes: [1] },
              undefined,
            ],
          }),
        ),
      /renderAfter: plan\.workOrder\[1\] must be an object/,
    );
  });

  test("valid plans are unchanged: ranked pick and middle pick", () => {
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
