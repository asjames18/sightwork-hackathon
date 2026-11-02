/**
 * Render-after input validation rejects a newline in spaceType up
 * front, instead of passing validation and only failing at the prompt
 * build, after the hero pick and visible-changes work: a newline in
 * the space type would split the edit prompt's first sentence, and
 * buildRenderAfterPrompt already rejects it, so a direct
 * validate-then-run caller gets the same fail-fast here, before any
 * work. Clean, omitted, and blank space types are unchanged.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateRenderAfterInput } from "@/lib/pipeline/renderAfter";
import type { WorkPlan } from "@/lib/types";

function input(spaceType?: string) {
  return {
    plan: { issues: [], workOrder: [] } as unknown as WorkPlan,
    spaceType,
  };
}

describe("renderAfter input spaceType newline", () => {
  test("rejects a newline in spaceType", () => {
    assert.throws(
      () => validateRenderAfterInput(input("church\nsanctuary")),
      /renderAfter: spaceType must not contain a newline when given/,
    );
  });

  test("rejects a carriage return in spaceType", () => {
    assert.throws(
      () => validateRenderAfterInput(input("church\rsanctuary")),
      /renderAfter: spaceType must not contain a newline when given/,
    );
  });

  test("still accepts a clean spaceType, an omitted one, and rejects a blank one as before", () => {
    assert.doesNotThrow(() => validateRenderAfterInput(input("church sanctuary")));
    assert.doesNotThrow(() => validateRenderAfterInput(input(undefined)));
    assert.throws(
      () => validateRenderAfterInput(input("   ")),
      /renderAfter: spaceType must be a non-empty string when given/,
    );
  });
});
