/**
 * Render-after input validation rejects a non-array fixes on a
 * work-order entry, naming the step index, instead of passing
 * validation and failing later in buildVisibleChanges with a raw
 * TypeError calling .includes off a non-array (or, for a string
 * fixes, silently matching by substring).
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

describe("renderAfter input work-order fixes type", () => {
  test("rejects a number fixes and names the index", () => {
    assert.throws(
      () => validateRenderAfterInput(input([{ title: "Paint wall", fixes: 1 }])),
      /renderAfter: plan\.workOrder\[0\]\.fixes must be an array when given/,
    );
  });

  test("rejects a string fixes and names the later index", () => {
    assert.throws(
      () =>
        validateRenderAfterInput(
          input([{ title: "Paint wall", fixes: [1] }, { title: "Fix light", fixes: "1" }]),
        ),
      /renderAfter: plan\.workOrder\[1\]\.fixes must be an array when given/,
    );
  });

  test("still accepts omitted, empty, and array fixes", () => {
    assert.doesNotThrow(() => validateRenderAfterInput(input([{ title: "Paint wall" }])));
    assert.doesNotThrow(() =>
      validateRenderAfterInput(input([{ title: "Paint wall", fixes: [] }])),
    );
    assert.doesNotThrow(() =>
      validateRenderAfterInput(input([{ title: "Paint wall", fixes: [1] }])),
    );
  });
});
