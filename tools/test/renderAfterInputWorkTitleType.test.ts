/**
 * Render-after input validation rejects a work-step title that is not
 * a string (including a missing one), naming the step index, instead
 * of passing validation and failing later with a raw TypeError while
 * the visible changes are built.
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

describe("renderAfter input work-step title type", () => {
  test("rejects a number title", () => {
    assert.throws(
      () => validateRenderAfterInput(input([{ title: 42, detail: "Paint" }])),
      /renderAfter: plan\.workOrder\[0\]\.title must be a string/,
    );
  });

  test("rejects a missing title and names the later index", () => {
    assert.throws(
      () =>
        validateRenderAfterInput(
          input([
            { title: "Repaint wall", detail: "Paint the wall" },
            { detail: "Replace the light" },
          ]),
        ),
      /renderAfter: plan\.workOrder\[1\]\.title must be a string/,
    );
  });

  test("rejects null and object titles", () => {
    for (const title of [null, { text: "Repaint" }]) {
      assert.throws(
        () => validateRenderAfterInput(input([{ title, detail: "Paint" }])),
        /renderAfter: plan\.workOrder\[0\]\.title must be a string/,
      );
    }
  });

  test("still accepts a clean string title and an empty work order", () => {
    assert.doesNotThrow(() =>
      validateRenderAfterInput(
        input([{ title: "Repaint wall", detail: "Paint the wall" }]),
      ),
    );
    assert.doesNotThrow(() => validateRenderAfterInput(input([])));
  });
});
