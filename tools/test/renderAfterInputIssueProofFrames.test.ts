/**
 * Render-after input validation rejects a non-array proofFrames on an
 * issues entry, naming the issue index, instead of passing validation
 * and failing later in buildVisibleChanges with a raw TypeError
 * calling .some off a non-array.
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

describe("renderAfter input issues proofFrames type", () => {
  test("rejects a number proofFrames and names the index", () => {
    assert.throws(
      () => validateRenderAfterInput(input([{ rank: 1, proofFrames: 42 }])),
      /renderAfter: plan\.issues\[0\]\.proofFrames must be an array when given/,
    );
  });

  test("rejects a string proofFrames and names the later index", () => {
    assert.throws(
      () =>
        validateRenderAfterInput(
          input([{ rank: 1 }, { rank: 2, proofFrames: "frame1" }]),
        ),
      /renderAfter: plan\.issues\[1\]\.proofFrames must be an array when given/,
    );
  });

  test("still accepts omitted, empty, and array proofFrames", () => {
    assert.doesNotThrow(() =>
      validateRenderAfterInput(input([{ rank: 1 }])),
    );
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
