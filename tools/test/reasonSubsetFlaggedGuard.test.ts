/** formatReasonSubsetFlagged malformed-input guard (server log only,
 * capped runs): the sibling subset lines all stay quiet on malformed
 * input, and this one either threw (a number or object side) or
 * silently miscounted (a string subset never matches a flagged
 * frame, so every flagged frame read as left out). Malformed inputs
 * now return null, the same quiet rule. Valid inputs are unchanged.
 * Pure, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatReasonSubsetFlagged } from "@/lib/pipeline/runPlan";

describe("formatReasonSubsetFlagged malformed-input guard", () => {
  test("a non-array flagged side stays quiet", () => {
    assert.equal(formatReasonSubsetFlagged(5 as unknown as number[], [0, 1]), null);
  });

  test("a non-array subset stays quiet", () => {
    assert.equal(formatReasonSubsetFlagged([1], "x" as unknown as number[]), null);
  });

  test("a valid take still renders the same flagged line", () => {
    assert.equal(
      formatReasonSubsetFlagged([1, 3, 7], [0, 1, 5]),
      "runPlan: reason subset: flagged 1/3 kept, left out: 3, 7",
    );
  });
});
