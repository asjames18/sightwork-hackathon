/**
 * Render-after input validation rejects a non-object proofFrames
 * entry on an issues entry, naming the issue and entry indices,
 * instead of passing validation and failing later in
 * buildVisibleChanges with a raw TypeError reading frameIndex off
 * null (when the hero differs from the issue's frameIndex, so the
 * proof-frames check actually runs).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateRenderAfterInput } from "@/lib/pipeline/renderAfter";
import type { WorkPlan } from "@/lib/types";

function input(issues: unknown[]) {
  return {
    plan: { issues, workOrder: [] } as unknown as WorkPlan,
  };
}

describe("renderAfter input issues proofFrames entry type", () => {
  test("rejects a null entry and names both indices", () => {
    assert.throws(
      () => validateRenderAfterInput(input([{ rank: 1, proofFrames: [null] }])),
      /renderAfter: plan\.issues\[0\]\.proofFrames\[0\] must be an object/,
    );
  });

  test("rejects a non-object entry and names the later indices", () => {
    assert.throws(
      () =>
        validateRenderAfterInput(
          input([
            { rank: 1, proofFrames: [{ frameIndex: 2 }] },
            { rank: 2, proofFrames: [{ frameIndex: 3 }, "frame4"] },
          ]),
        ),
      /renderAfter: plan\.issues\[1\]\.proofFrames\[1\] must be an object/,
    );
  });

  test("still accepts omitted, empty, and object proofFrames entries", () => {
    assert.doesNotThrow(() => validateRenderAfterInput(input([{ rank: 1 }])));
    assert.doesNotThrow(() =>
      validateRenderAfterInput(input([{ rank: 1, proofFrames: [] }])),
    );
    assert.doesNotThrow(() =>
      validateRenderAfterInput(
        input([{ rank: 1, proofFrames: [{ frameIndex: 2 }] }]),
      ),
    );
  });
});
