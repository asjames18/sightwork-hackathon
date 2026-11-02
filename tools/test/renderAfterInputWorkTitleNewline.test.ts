/**
 * Render-after input validation rejects a newline in a visible
 * work-step title up front, instead of passing validation and only
 * failing at the prompt build, after the hero pick and
 * visible-changes work: the title is the prompt line, so
 * buildRenderAfterPrompt already rejects it. A direct
 * validate-then-run caller gets the same fail-fast here, before any
 * work. Hidden and non-visible titles still pass, since their lines
 * never reach the prompt.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildRenderAfterPrompt,
  validateRenderAfterInput,
} from "@/lib/pipeline/renderAfter";
import type { WorkPlan } from "@/lib/types";

function input(workOrder: unknown[]) {
  return {
    plan: { issues: [], workOrder } as unknown as WorkPlan,
  };
}

describe("renderAfter input visible title newline", () => {
  test("rejects a newline in a visible work-step title", () => {
    assert.throws(
      () =>
        validateRenderAfterInput(
          input([{ title: "Repaint\nwall", detail: "Paint the wall" }]),
        ),
      /renderAfter: plan\.workOrder\[0\]\.title must not contain a newline/,
    );
  });

  test("rejects a carriage return in a visible work-step title", () => {
    assert.throws(
      () =>
        validateRenderAfterInput(
          input([{ title: "Repaint\rwall", detail: "Paint the wall" }]),
        ),
      /renderAfter: plan\.workOrder\[0\]\.title must not contain a newline/,
    );
  });

  test("names the step index for a later newline title", () => {
    assert.throws(
      () =>
        validateRenderAfterInput(
          input([
            { title: "Repaint wall", detail: "Paint the wall" },
            { title: "Fix\nlight", detail: "Replace the light" },
          ]),
        ),
      /renderAfter: plan\.workOrder\[1\]\.title must not contain a newline/,
    );
  });

  test("still accepts clean, hidden, and non-visible newline titles", () => {
    assert.doesNotThrow(() =>
      validateRenderAfterInput(
        input([{ title: "Repaint wall", detail: "Paint the wall" }]),
      ),
    );
    assert.doesNotThrow(() =>
      validateRenderAfterInput(
        input([
          {
            title: "Inspect\nwiring above ceiling",
            detail: "Check above the ceiling",
          },
        ]),
      ),
    );
    assert.doesNotThrow(() =>
      validateRenderAfterInput(
        input([{ title: "Fix\nbudget", detail: "Sort the budget" }]),
      ),
    );
  });

  test("the prompt builder already rejects the same line", () => {
    assert.throws(
      () => buildRenderAfterPrompt("room", ["Repaint\nwall"]),
      /must not contain a newline/,
    );
  });
});
