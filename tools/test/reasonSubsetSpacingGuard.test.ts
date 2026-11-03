/** formatReasonSubsetSpacing malformed-input guard (server log only,
 * capped runs): the sibling subset lines all stay quiet on malformed
 * input, and this one threw on a non-array subset (a number or null
 * in the spread, or on .length) instead of staying quiet. Malformed
 * inputs now return null, the same quiet rule. Valid inputs are
 * unchanged. Pure, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatReasonSubsetSpacing } from "@/lib/pipeline/runPlan";

describe("formatReasonSubsetSpacing malformed-input guard", () => {
  test("a non-array tSecs side stays quiet", () => {
    assert.equal(
      formatReasonSubsetSpacing(5 as unknown as number[], [0, 1]),
      null,
    );
  });

  test("a non-array subset stays quiet", () => {
    assert.equal(
      formatReasonSubsetSpacing([0, 10, 20], 5 as unknown as number[]),
      null,
    );
  });

  test("a valid take still renders the same spacing line", () => {
    assert.equal(
      formatReasonSubsetSpacing([0, 10, 20, 30], [0, 1, 2, 3]),
      "runPlan: reason subset: max gap 10.0s between frames 0 and 1",
    );
  });
});
