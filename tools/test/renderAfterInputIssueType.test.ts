/**
 * Render-after input validation rejects a non-object issues entry,
 * naming the issue index, instead of passing validation and failing
 * later in buildVisibleChanges with a raw TypeError reading frameIndex
 * off null.
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

describe("renderAfter input issues entry type", () => {
  test("rejects a null entry and names the index", () => {
    assert.throws(
      () => validateRenderAfterInput(input([null])),
      /renderAfter: plan\.issues\[0\] must be an object/,
    );
  });

  test("rejects a string entry and names the later index", () => {
    assert.throws(
      () =>
        validateRenderAfterInput(
          input([
            { rank: 1, frameIndex: 0 },
            "peeling paint",
          ]),
        ),
      /renderAfter: plan\.issues\[1\] must be an object/,
    );
  });

  test("rejects a number entry", () => {
    assert.throws(
      () => validateRenderAfterInput(input([42])),
      /renderAfter: plan\.issues\[0\] must be an object/,
    );
  });

  test("still accepts clean issue objects and an empty issues list", () => {
    assert.doesNotThrow(() =>
      validateRenderAfterInput(
        input([{ rank: 1, frameIndex: 0, title: "Peeling paint" }]),
      ),
    );
    assert.doesNotThrow(() => validateRenderAfterInput(input([])));
  });
});
