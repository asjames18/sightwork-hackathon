/**
 * Render-after input validation rejects a non-object work-order entry,
 * naming the step index, instead of passing validation and failing
 * later in buildVisibleChanges with a raw TypeError reading fixes off
 * null.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateRenderAfterInput } from "@/lib/pipeline/renderAfter";
import type { WorkPlan } from "@/lib/types";

function input(workOrder: unknown[]) {
  return {
    plan: { issues: [], workOrder } as unknown as WorkPlan,
  };
}

describe("renderAfter input work-order entry type", () => {
  test("rejects a null entry and names the index", () => {
    assert.throws(
      () => validateRenderAfterInput(input([null])),
      /renderAfter: plan\.workOrder\[0\] must be an object/,
    );
  });

  test("rejects a string entry and names the later index", () => {
    assert.throws(
      () =>
        validateRenderAfterInput(
          input([{ title: "Paint wall" }, "fix door"]),
        ),
      /renderAfter: plan\.workOrder\[1\] must be an object/,
    );
  });

  test("rejects a number entry", () => {
    assert.throws(
      () => validateRenderAfterInput(input([42])),
      /renderAfter: plan\.workOrder\[0\] must be an object/,
    );
  });

  test("still accepts clean work-order objects and an empty list", () => {
    assert.doesNotThrow(() =>
      validateRenderAfterInput(input([{ title: "Paint wall" }])),
    );
    assert.doesNotThrow(() => validateRenderAfterInput(input([])));
  });
});
