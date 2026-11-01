/** formatReasonSubsetFlagged (server log only, capped runs): reports how many of SAM's flagged frames the reason subset kept, and names any flagged frame left out, so a real Large/XL run shows whether the reason step saw every flagged frame. Pure, no network, no plan output. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatReasonSubsetFlagged } from "@/lib/pipeline/runPlan";

describe("formatReasonSubsetFlagged", () => {
  test("all flagged kept reports no left-out part", () => {
    assert.equal(
      formatReasonSubsetFlagged([1, 3], [0, 1, 3, 5]),
      "runPlan: reason subset: flagged 2/2 kept",
    );
  });

  test("flagged frames left out are named", () => {
    assert.equal(
      formatReasonSubsetFlagged([1, 3, 7], [0, 1, 5]),
      "runPlan: reason subset: flagged 1/3 kept, left out: 3, 7",
    );
  });

  test("no flagged frames stays quiet", () => {
    assert.equal(formatReasonSubsetFlagged([], [0]), null);
  });

  test("duplicate flagged frames count once", () => {
    assert.equal(
      formatReasonSubsetFlagged([2, 2, 4], [2]),
      "runPlan: reason subset: flagged 1/2 kept, left out: 4",
    );
  });

  test("left-out flagged frames sort ascending", () => {
    assert.equal(
      formatReasonSubsetFlagged([9, 3], [0]),
      "runPlan: reason subset: flagged 0/2 kept, left out: 3, 9",
    );
  });
});
